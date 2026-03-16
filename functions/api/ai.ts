/**
 * POST /api/ai
 *
 * ChainSolve AI server-side proxy (AI-1 / AI-2 / AI-3).
 *
 * 1. Verify Supabase JWT -> get user identity.
 * 2. Check plan entitlements (Pro/Enterprise only).
 * 3. Enterprise policy enforcement (ai_enabled, ai_allowed_modes, per-seat quotas).
 * 4. Enforce monthly token quota.
 * 5. Build task-specific system prompt (chat/fix_graph/explain_node/generate_*).
 * 6. Call OpenAI Responses API (store: false) with JSON output.
 * 7. Validate response JSON; repair once if invalid.
 * 8. Log request metadata (no content) to ai_request_log.
 * 9. Update ai_usage_monthly counters.
 * 10. Return structured response with tokensRemaining.
 *
 * Env vars: OPEN_AI_API_KEY, AI_MODEL (optional, default gpt-4.1),
 *           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { jsonError } from './stripe/_lib'

// ── Types ───────────────────────────────────────────────────────────────────

type Env = {
  OPEN_AI_API_KEY: string
  AI_MODEL?: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

type AiTask =
  | 'chat'
  | 'fix_graph'
  | 'explain_node'
  | 'generate_template'
  | 'generate_theme'
  | 'optimize'
  | 'suggest'

interface AiRequestBody {
  mode: 'plan' | 'edit' | 'bypass'
  scope: 'active_canvas' | 'selection'
  task?: AiTask
  userMessage: string
  projectId: string
  canvasId: string
  selectedNodeIds: string[]
  /** 6.05: Request streaming SSE response. */
  stream?: boolean
  clientContext?: {
    locale?: string
    theme?: string
    decimalPlaces?: number
    diagnostics?: { level: string; code: string; message: string; nodeIds?: string[] }[]
    /** 6.02: Computed values per node — nodeId → scalar number or error string. */
    computedValues?: Record<string, number | string>
  }
}

type Plan = 'free' | 'trialing' | 'pro' | 'student' | 'enterprise' | 'past_due' | 'canceled'

// ── Constants ───────────────────────────────────────────────────────────────

const PRO_MONTHLY_TOKEN_LIMIT = 200_000
const ENTERPRISE_DEFAULT_TOKEN_LIMIT = 1_000_000
const MAX_PROMPT_LENGTH = 4000
const VALID_TASKS: AiTask[] = [
  'chat',
  'fix_graph',
  'explain_node',
  'generate_template',
  'generate_theme',
  'optimize',
  'suggest',
]

// ── Comprehensive block catalog for system prompt (6.01) ────────────────────

const BLOCK_CATALOG_DIGEST = `Available blockTypes (use ONLY these). Format: type(input_port_ids).

INPUT: number(), slider(), variableSource(), constant(), material(), subscribe(), tableInput()
OUTPUT: display(value), publish(value)
MATH: add(a,b), subtract(a,b), multiply(a,b), divide(a,b), negate(a), abs(a), sqrt(a), power(base,exp), floor(a), ceil(a), round(a), mod(a,b), clamp(val,min,max), trunc(a), sign(a), ln(a), log10(a), exp(a), log_base(val,base), roundn(val,digits)
TRIG: sin(a), cos(a), tan(a), asin(a), acos(a), atan(a), atan2(y,x), degToRad(deg), radToDeg(rad)
LOGIC: greater(a,b), less(a,b), equal(a,b), ifthenelse(cond,then,else), max(a,b), min(a,b)

MECHANICS: eng.mechanics.v_from_uat(u,a,t), eng.mechanics.s_from_ut_a_t(u,t,a), eng.mechanics.v2_from_u2_as(u,a,s), eng.mechanics.force_ma(m,a), eng.mechanics.weight_mg(m,g), eng.mechanics.momentum_mv(m,v), eng.mechanics.kinetic_energy(m,v), eng.mechanics.potential_energy(m,g,h), eng.mechanics.work_Fs(F,s), eng.mechanics.power_work_time(W,t), eng.mechanics.power_Fv(F,v), eng.mechanics.torque_Fr(F,r), eng.mechanics.omega_from_rpm(rpm), eng.mechanics.rpm_from_omega(omega), eng.mechanics.power_rot_Tomega(T,omega), eng.mechanics.centripetal_acc(v,r), eng.mechanics.centripetal_force(m,v,r), eng.mechanics.friction_force(mu,N), eng.mechanics.impulse(F,dt)
MATERIALS: eng.materials.stress_F_A(F,A), eng.materials.strain_dL_L(dL,L), eng.materials.youngs_modulus(sigma,epsilon), eng.materials.pressure_F_A(F,A), eng.materials.safety_factor(strength,stress), eng.materials.spring_force_kx(k,x), eng.materials.spring_energy(k,x)
SECTIONS: eng.sections.area_circle(d), eng.sections.area_annulus(d_outer,d_inner), eng.sections.I_rect(b,h), eng.sections.I_circle(d), eng.sections.J_circle(d), eng.sections.bending_stress(M,y,I), eng.sections.torsional_shear(T,r,J)
INERTIA: eng.inertia.solid_cylinder(m,r), eng.inertia.hollow_cylinder(m,r_inner,r_outer), eng.inertia.solid_sphere(m,r), eng.inertia.rod_center(m,L), eng.inertia.rod_end(m,L)
FLUIDS: eng.fluids.flow_Q_from_Av(A,v), eng.fluids.velocity_from_QA(Q,A), eng.fluids.mass_flow(rho,Q), eng.fluids.reynolds(rho,v,D,mu), eng.fluids.dynamic_pressure(rho,v), eng.fluids.hagen_poiseuille_dp(mu,L,Q,D), eng.fluids.darcy_weisbach_dp(f,L,D,rho,v), eng.fluids.buoyancy(rho,V,g)
THERMO: eng.thermo.ideal_gas_P(n,R,T,V), eng.thermo.ideal_gas_T(P,V,n,R), eng.thermo.heat_Q_mcDT(m,c,dT), eng.thermo.conduction_Qdot(k,A,dT,L), eng.thermo.convection_Qdot(h,A,dT), eng.thermo.carnot_efficiency(T_cold,T_hot), eng.thermo.thermal_expansion(alpha,L,dT)
ELECTRICAL: eng.elec.ohms_V(I,R), eng.elec.power_VI(V,I), eng.elec.power_I2R(I,R), eng.elec.power_V2R(V,R), eng.elec.capacitance_Q_V(Q,V), eng.elec.series_resistance(R1,R2), eng.elec.parallel_resistance(R1,R2), eng.elec.RC_tau(R,C), eng.elec.RL_tau(R,L), eng.elec.RLC_f0(L,C), eng.elec.RLC_Q(R,L,C), eng.elec.V_divider(Vin,R1,R2), eng.elec.I_divider(Iin,R1,R2), eng.elec.Z_cap(f,C), eng.elec.Z_ind(f,L), eng.elec.filter_fc(R,C), eng.elec.transformer_v2(V1,N1,N2), eng.elec.three_phase_P(VL,IL,pf), eng.elec.diode_shockley(Is,V,eta,Vt)
CONVERSIONS: eng.conv.deg_to_rad(deg), eng.conv.rad_to_deg(rad), eng.conv.mm_to_m(mm), eng.conv.m_to_mm(m), eng.conv.bar_to_pa(bar), eng.conv.pa_to_bar(Pa), eng.conv.lpm_to_m3s(lpm), eng.conv.m3s_to_lpm(m3s), unit_convert(value)

FINANCE TVM: fin.tvm.simple_interest(P,r,t), fin.tvm.compound_fv(PV,r,n,t), fin.tvm.compound_pv(FV,r,n,t), fin.tvm.continuous_fv(PV,r,t), fin.tvm.annuity_pv(PMT,r,n), fin.tvm.annuity_fv(PMT,r,n), fin.tvm.annuity_pmt(PV,r,n), fin.tvm.npv(r,c,cf0,cf1,cf2,cf3,cf4,cf5), fin.tvm.rule_of_72(r), fin.tvm.effective_rate(r,n)
FINANCE RETURNS: fin.returns.pct_return(v0,v1), fin.returns.log_return(v0,v1), fin.returns.cagr(v0,v1,t), fin.returns.sharpe(ret,rf,sigma), fin.returns.weighted_avg(c,x1..x6,y1..y6), fin.returns.portfolio_variance(w1,w2,s1,s2,rho)
FINANCE DEPR: fin.depr.straight_line(cost,salvage,life), fin.depr.declining_balance(cost,salvage,life,period)
FINANCE OPTIONS: fin.options.bs_call(S,K,T,r,sigma), fin.options.bs_put(S,K,T,r,sigma), fin.options.bs_delta(S,K,T,r,sigma), fin.options.bs_gamma(S,K,T,r,sigma), fin.options.bs_vega(S,K,T,r,sigma), fin.options.kelly(p_win,b), fin.options.var_hist(returns,conf), fin.options.cvar_hist(returns,conf), fin.options.bond_duration(coupon,face,ytm,n), fin.options.dcf(fcf,wacc,g,n)

DESCRIPTIVE STATS: stats.desc.mean(c,x1..x6), stats.desc.median(c,x1..x6), stats.desc.mode_approx(c,x1..x6), stats.desc.range(c,x1..x6), stats.desc.variance(c,x1..x6), stats.desc.stddev(c,x1..x6), stats.desc.sum(c,x1..x6), stats.desc.geo_mean(c,x1..x6), stats.desc.zscore(x,mu,sigma)
RELATIONSHIPS: stats.rel.covariance(c,x1..x6,y1..y6), stats.rel.correlation(c,x1..x6,y1..y6), stats.rel.linreg_slope(c,x1..x6,y1..y6), stats.rel.linreg_intercept(c,x1..x6,y1..y6)
COMBINATORICS: prob.comb.factorial(n), prob.comb.permutation(n,k), prob.comb.combination(n,k)
DISTRIBUTIONS: prob.dist.binomial_pmf(n,k,p), prob.dist.poisson_pmf(k,lambda), prob.dist.exponential_pdf(x,lambda), prob.dist.exponential_cdf(x,lambda), prob.dist.normal_pdf(x,mu,sigma), prob.dist.normal_cdf(x,mu,sigma), prob.dist.normal_inv_cdf(p,mu,sigma), prob.dist.t_pdf(x,df), prob.dist.t_cdf(x,df), prob.dist.chi2_pdf(x,k), prob.dist.chi2_cdf(x,k), prob.dist.f_pdf(x,d1,d2), prob.dist.f_cdf(x,d1,d2), prob.dist.poisson_cdf(k,lambda), prob.dist.binomial_cdf(k,n,p), prob.dist.beta_pdf(x,a,b), prob.dist.beta_cdf(x,a,b), prob.dist.gamma_pdf(x,alpha,beta), prob.dist.weibull_pdf(x,k,lambda)
UTILITIES: util.round.to_dp(x,dp), util.pct.to_decimal(pct)

CHEMICAL ENG: chem.ideal_gas_n(P,V,R,T), chem.antoine_vp(A,B,C,T), chem.raoults_partial(x,Psat), chem.equilibrium_K(dG,R,T), chem.arrhenius_rate(A,Ea,R,T), chem.heat_reaction(H_prod,H_react), chem.mole_fraction(n_comp,n_total), chem.ficks_flux(D,dC_dx), chem.CSTR_conv(k,tau), chem.enthalpy_sensible(Cp,T1,T2)
STRUCTURAL ENG: struct.beam_deflect_ss(P,L,E,I), struct.beam_deflect_cantilever(P,L,E,I), struct.beam_moment_ss(P,a,b,L), struct.euler_buckling(E,I,L,K), struct.von_mises(sx,sy,txy), struct.combined_stress(s_ax,s_bend), struct.steel_check(sigma,Fy,phi), struct.bearing_capacity(c,gamma,D,B,Nc,Nq,Ngamma), struct.concrete_moment_aci(fc,b,d,As,fy)
AEROSPACE: aero.ISA_T(h), aero.ISA_P(h), aero.ISA_rho(h), aero.ISA_a(h), aero.mach_from_v(v,a), aero.dynamic_q(rho,v), aero.lift(CL,q,S), aero.drag(CD,q,S), aero.tsfc(thrust,fuel_flow), aero.tsiolkovsky(Isp,g0,m0,mf), aero.orbital_v(GM,r), aero.escape_v(GM,r), aero.hohmann_dv1(GM,r1,r2), aero.hohmann_dv2(GM,r1,r2)
CONTROL SYSTEMS: ctrl.step_1st_order(K,tau,t), ctrl.step_2nd_order(K,wn,zeta,t), ctrl.pid_output(Kp,Ki,Kd,error,integral,dt), ctrl.rms(y), ctrl.peak2peak(y), ctrl.settling_time_2pct(tau), ctrl.overshoot_2nd(zeta), ctrl.natural_freq(k,m), ctrl.damping_ratio(c,k,m), ctrl.bode_mag_1st(K,omega,tau)
LIFE SCIENCES: bio.michaelis_menten(Vmax,Km,S), bio.hill_eq(n,Kd,L), bio.logistic_growth(r,K,N0,t), bio.exp_decay(N0,lambda,t), bio.half_life(lambda), bio.drug_1cmp(D,V,k,t), bio.henderson_hasselbalch(pKa,A,HA), bio.nernst(R,T,z,F,C_out,C_in), bio.BMI(mass_kg,height_m), bio.BSA_dubois(W_kg,H_cm)
DATE/TIME: date.from_ymd(y,m,d), date.year(day), date.month(day), date.day_of_month(day), date.days_between(d1,d2), date.add_days(d,n), date.is_leap_year(y), date.days_in_month(m,y)
TEXT: num_to_text(value), text_concat(a,b), text_length(value), text_to_num(text)

LIST OPS: vectorLength(vec), vectorSum(vec), vectorMean(vec), vectorMin(vec), vectorMax(vec), vectorSort(vec), vectorReverse(vec), vectorSlice(vec,start,end), vectorConcat(a,b), vectorMap(vec,scalar)
TABLE OPS: table_extract_col(table,index)
LOOKUP: lookup.1d(x_vec,y_vec,x), lookup.2d(x_vec,y_vec,z_mat,x,y)
INTERVAL ARITHMETIC: interval_from(center,half_width), interval_from_bounds(lo,hi), interval_lo(interval), interval_hi(interval), interval_mid(interval), interval_width(interval), interval_contains(interval,x), interval_add(a,b), interval_sub(a,b), interval_mul(a,b), interval_div(a,b), interval_pow(a,n)
SIGNAL PROCESSING: signal.fft_magnitude(y), signal.fft_power(y), signal.fft_freq_bins(n,sample_rate), signal.window_hann(n), signal.window_hamming(n), signal.window_blackman(n), signal.filter_lowpass_fir(y,cutoff_norm,taps), signal.filter_highpass_fir(y,cutoff_norm,taps)
COMPLEX NUMBERS: complex_from(re,im), complex_re(z), complex_im(z), complex_mag(z), complex_arg(z), complex_conj(z), complex_add(z1,z2), complex_mul(z1,z2), complex_div(z1,z2), complex_exp(z), complex_ln(z), complex_pow(z,n)
MATRIX OPS: matrix_from_table(table), matrix_to_table(matrix), matrix_multiply(a,b), matrix_transpose(matrix), matrix_inverse(matrix), matrix_det(matrix), matrix_trace(matrix), matrix_solve(a,b)
PLOT: xyPlot(data), histogram(data), barChart(data), heatmap(data), listTable(data)

OPTIMIZATION: optim.designVariable(), optim.objectiveFunction(value), optim.gradientDescent(objective,variables), optim.geneticAlgorithm(objective,variables), optim.nelderMead(objective,variables), optim.convergencePlot(data), optim.resultsTable(data), optim.parametricSweep(objective,variable), optim.monteCarlo(objective,variables), optim.sensitivity(objective,variables), optim.doe(variables)
MACHINE LEARNING: ml.trainTestSplit(data), ml.linearRegression(trainX,trainY), ml.polynomialRegression(trainX,trainY), ml.knnClassifier(trainX,trainY), ml.decisionTree(trainX,trainY), ml.predict(model,data), ml.mse(actual,predicted), ml.r2(actual,predicted), ml.confusionMatrix(actual,predicted)
NEURAL NETWORKS: nn.input(), nn.dense(input), nn.conv1d(input), nn.dropout(input), nn.activation(input), nn.sequential(layers), nn.trainer(model,trainX,trainY), nn.predict(model,data), nn.export(model)

Port naming: binary ops use a,b. All blocks output via "out" handle.
Edge sourceHandle is always "out". Edge targetHandle is the port id (e.g. "a", "b", "value").
Node IDs: use "ai_node_1", "ai_node_2", etc. Edge IDs: use "ai_edge_1", etc.
For stats blocks with c,x1..x6: c = count of values, x1..x6 = values. For relationship blocks, also y1..y6.
For "number" nodes, set data.value. For "slider" nodes, set data.value, data.min, data.max, data.step.
For "constant" nodes, set data.selectedConstantId (e.g. "pi", "euler", "tau", "phi", or any constant from the catalog).

ADVANCED OPS (beyond addNode/addEdge/removeNode/removeEdge/updateNodeData/setInputBinding/createVariable/updateVariable):

createMaterial: Create a custom material saved in the user's browser.
  { "op": "createMaterial", "material": { "name": "Ti-6Al-4V", "description": "Titanium alloy", "category": "metal", "properties": { "rho": 4430, "E": 113.8e9, "nu": 0.342 } } }
  Categories: metal, polymer, ceramic, composite, fluid, other.
  Properties: rho (density kg/m3), E (Young's modulus Pa), nu (Poisson's ratio), mu (dynamic viscosity Pa·s), k (thermal conductivity W/m·K), cp (specific heat J/kg·K). Include only relevant properties.

createCustomFunction: Create a reusable custom function block.
  { "op": "createCustomFunction", "fn": { "name": "Cylinder Volume", "description": "V = pi*r^2*h", "tag": "engineering", "inputs": [{ "id": "r", "label": "Radius" }, { "id": "h", "label": "Height" }], "formula": "pi * r^2 * h" } }
  Tags: math, physics, engineering, finance, statistics, other.
  Formula uses input IDs as variables. Max 8 inputs.

createGroup: Organize existing nodes into a visual group.
  { "op": "createGroup", "nodeIds": ["ai_node_1", "ai_node_2"], "label": "Input Parameters", "color": "#1CABB0" }
  Requires at least 2 existing node IDs. Use groups to organize large layouts logically.

CSV nodes: When the canvas contains "csv" blockType nodes, they load tabular data from uploaded CSV files. You can reference CSV column values via edges from csv nodes. When building scientific models from data, connect csv column outputs to computation chains.`

// ── System prompts per task ─────────────────────────────────────────────────

function buildSystemPrompt(mode: string, task: AiTask): string {
  const base = `You are ChainSolve AI, an expert AI assistant that helps users build node-graph calculation chains. You are a domain expert in engineering, science, finance, and mathematics.

Think step-by-step before responding. Reason through the problem, plan the graph structure, then generate the JSON response. Consider:
1. What quantities are needed and their relationships
2. Which specialized blocks best model each computation
3. How to organize nodes into logical groups
4. What realistic default values to use (with proper units)

${BLOCK_CATALOG_DIGEST}

RULES:
- Return ONLY valid JSON matching the required schema. No markdown, no code fences.
- Always include a "thinking" field in your JSON response with your step-by-step reasoning before providing the final answer. This should be a clear explanation of your approach, what calculations you're setting up, and why you chose specific blocks.
- Do NOT hallucinate blockType values. Only use block types from the catalog above.
- All node IDs must be unique strings prefixed with "ai_node_".
- All edge IDs must be unique strings prefixed with "ai_edge_".
- Edge sourceHandle is ALWAYS "out". Edge targetHandle is the input port id.
- For "number" nodes, set data.value to the numeric value.
- Position nodes in a readable left-to-right layout (x increases by ~200 per column).
- Keep explanations concise. Focus on the graph structure.
- Assess risk honestly: low for simple additions, medium for >10 ops or variable changes, high for removals.

COLORING: After creating nodes, include updateNodeData ops to set "userColor" for visual categorization of different subsystems:
- Input parameters: "#3B82F6" (blue)
- Core computation: "#8B5CF6" (purple)
- Constants/references: "#F59E0B" (amber)
- Output/display nodes: "#10B981" (green)
- Constraints/limits: "#EF4444" (red)

GROUPS: You MUST organize related nodes into logical groups using createGroup ops for ANY response with 4 or more nodes. Name groups descriptively (e.g., "Input Parameters", "Aerodynamics", "Results Display"). Use different colors per subsystem group. Every node should belong to a group. This is mandatory, not optional.

BEST PRACTICES:
- Set descriptive labels on ALL nodes. Never use raw blockType as label. Labels should describe what the value represents (e.g., "Car Mass (kg)" not "number").
- Use display blocks with units for all key outputs so users can see results immediately.
- Layout nodes left-to-right: inputs on the left (~x:100), computation in the middle (~x:400-700), outputs on the right (~x:900+). Space nodes vertically ~60px apart.
- When engineering/science blocks exist in the catalog (kinetic_energy, force_ma, etc.), use them instead of building manual arithmetic chains.
- Use unit_convert blocks when units need converting between subsystems.
- For large models, create clear visual separation between subsystems by using groups with distinct colors and spacing groups ~100px apart vertically.`

  if (task === 'fix_graph') {
    return `${base}

TASK: FIX GRAPH
You are given diagnostics about issues in the user's graph. Propose patch ops that fix them.
Common fixes: add missing connections, remove duplicate edges, fix fan-in violations, set default values for unconnected inputs.
For cycles: explain why the cycle exists and suggest which edge to remove, but mark as high risk.
Do NOT delete nodes unless explicitly asked. Prefer fixing connections and bindings.
Mode: ${mode}

Required JSON response:
{
  "thinking": "step-by-step reasoning about the fix",
  "mode": "${mode}",
  "message": "what was fixed and why",
  "assumptions": ["any assumptions"],
  "risk": { "level": "low"|"medium"|"high", "reasons": ["..."] },
  "patch": { "ops": [...] }
}`
  }

  if (task === 'explain_node') {
    return `${base}

TASK: EXPLAIN NODE
Explain the selected node(s): what the block does, current inputs/bindings, upstream dependencies, and any diagnostics.
This is READ-ONLY. Do NOT propose any patch ops. Return empty ops array.

Required JSON response:
{
  "thinking": "step-by-step reasoning about the node analysis",
  "mode": "plan",
  "message": "concise explanation of the node and its role in the chain",
  "assumptions": [],
  "risk": { "level": "low", "reasons": [] },
  "patch": { "ops": [] },
  "explanation": {
    "block": { "type": "blockType", "whatItDoes": "description", "inputs": ["port names"], "outputs": ["out"] },
    "bindings": [{ "portId": "a", "source": "edge|literal|default", "value": 10 }],
    "upstream": [{ "nodeId": "n1", "label": "Force", "blockType": "number" }],
    "diagnostics": [{ "level": "warn", "code": "orphan", "message": "..." }]
  }
}`
  }

  if (task === 'generate_template') {
    return `${base}

TASK: GENERATE TEMPLATE
Based on the user's selection, generate a reusable template artifact with metadata.
The template should be a self-contained subgraph (nodes + edges) with normalized positions.

Required JSON response:
{
  "thinking": "step-by-step reasoning about the template",
  "mode": "plan",
  "message": "description of the template",
  "assumptions": [],
  "risk": { "level": "low", "reasons": [] },
  "patch": { "ops": [] },
  "template": {
    "name": "Template Name",
    "description": "What this template does",
    "tags": ["engineering", "mechanics"]
  }
}`
  }

  if (task === 'generate_theme') {
    return `${base}

TASK: GENERATE THEME
Based on the user's description, generate CSS variable values for a ChainSolve theme.
Available CSS variables: --bg-primary, --bg-secondary, --bg-tertiary, --text-primary, --text-secondary, --accent, --accent-hover, --accent-active, --node-bg, --node-border, --node-header, --node-header-text, --node-text, --node-port, --edge-default, --edge-selected, --edge-animated, --handle-bg, --handle-border.
Values must be valid CSS color values (hex, rgb, hsl).

Required JSON response:
{
  "thinking": "step-by-step reasoning about the theme design",
  "mode": "plan",
  "message": "description of the theme",
  "assumptions": [],
  "risk": { "level": "low", "reasons": [] },
  "patch": { "ops": [] },
  "theme": {
    "name": "Theme Name",
    "baseMode": "dark"|"light",
    "variables": { "--bg-primary": "#1a1a2e", "--accent": "#e94560", ... }
  }
}`
  }

  if (task === 'optimize') {
    return `${base}

TASK: OPTIMIZE GRAPH
Analyse the user's graph for inefficiencies and suggest optimizations:
- Identify redundant or duplicate computation chains that can be merged.
- Spot unnecessary intermediate nodes that could be replaced by a single block.
- Suggest reordering or restructuring for clarity and performance.
- Recommend using groups to organise related blocks.
- If constant sub-expressions exist, suggest folding them into a single constant.
Do NOT remove nodes unless redundancy is clear. Prefer restructuring over deletion.
Mark risk as medium if proposing structural changes, low for cosmetic changes.
Mode: ${mode}

Required JSON response:
{
  "thinking": "step-by-step reasoning about the optimizations",
  "mode": "${mode}",
  "message": "summary of optimizations found and proposed changes",
  "assumptions": ["any assumptions"],
  "risk": { "level": "low"|"medium"|"high", "reasons": ["..."] },
  "patch": { "ops": [...] }
}`
  }

  if (task === 'suggest') {
    return `${base}

TASK: SUGGEST IMPROVEMENTS
Review the user's graph and suggest improvements:
- Missing validation or error handling (e.g. division by zero guards, range checks).
- Additional outputs that would be useful (e.g. intermediate results, unit conversions).
- Better block choices (e.g. using a specialised engineering block instead of raw math).
- Missing connections or unused outputs that could feed downstream calculations.
- Opportunities to add documentation via annotations or labels.
This is primarily advisory. Propose patch ops only when the improvement is concrete and low-risk.
For complex suggestions, describe them in the message and set ops to empty.
Mode: ${mode}

Required JSON response:
{
  "thinking": "step-by-step reasoning about the improvements",
  "mode": "${mode}",
  "message": "list of suggested improvements with rationale",
  "assumptions": ["any assumptions"],
  "risk": { "level": "low"|"medium"|"high", "reasons": ["..."] },
  "patch": { "ops": [...] }
}`
  }

  // Default: chat task
  return `${base}
- Current mode: ${mode}
  - plan: describe steps only, patch.ops should be empty.
  - edit: You MUST generate patch.ops that implement the user's request. Do NOT just explain — actually create the nodes and edges. Every request in edit mode should produce concrete addNode/addEdge ops unless the user explicitly asks for an explanation only.
  - bypass: propose ops for auto-apply (user still confirms high-risk).
- IMPORTANT: When mode is "edit", always include the actual patch ops to implement the request. The user expects blocks to appear on their canvas, not just a text explanation.

ADDITIONAL CHAT BEST PRACTICES:
- LABELS: Give every number node a descriptive label with units, e.g. "Mass (kg)", "Velocity (m/s)", "Pressure (Pa)". Never leave labels as defaults.
- DISPLAY BLOCKS: Add display blocks for key outputs and intermediate results so the user can see computed values. Label them clearly, e.g. "Total Force (N)", "Efficiency (%)".
- ENGINEERING BLOCKS: Prefer specialized engineering blocks (e.g. eng.mechanics.kinetic_energy) over building the formula from raw math blocks. This is more readable and less error-prone.
- MATERIALS: When building engineering models, define materials using createMaterial ops with realistic properties (density, Young's modulus, etc.).
- CUSTOM FUNCTIONS: For repeated calculations, create reusable custom functions with createCustomFunction instead of duplicating node chains.
- CONSTANTS: Use "constant" blocks with data.selectedConstantId for physical constants (pi, euler, etc.) instead of hardcoding numbers.
- REALISTIC VALUES: Use accurate, realistic default values with proper units. For engineering models, cite standard reference values.
- COMPLETENESS: Build comprehensive models. If the user asks for an F1 car model, include all major subsystems (engine, aero, tires, braking, suspension) with proper interconnections.

Required JSON response schema:
{
  "thinking": "step-by-step reasoning about your approach",
  "mode": "${mode}",
  "message": "human explanation of what this does",
  "assumptions": ["any assumptions made"],
  "risk": { "level": "low"|"medium"|"high", "reasons": ["..."] },
  "patch": {
    "ops": [
      { "op": "addNode", "node": { "id": "ai_node_1", "blockType": "number", "label": "Force", "position": { "x": 100, "y": 100 }, "data": { "blockType": "number", "label": "Force", "value": 10 } } },
      { "op": "addEdge", "edge": { "id": "ai_edge_1", "source": "ai_node_1", "sourceHandle": "out", "target": "ai_node_2", "targetHandle": "a" } },
      { "op": "updateNodeData", "nodeId": "existing_id", "data": { "value": 42 } },
      { "op": "removeNode", "nodeId": "existing_id" },
      { "op": "removeEdge", "edgeId": "existing_id" },
      { "op": "createMaterial", "material": { "name": "...", "category": "metal", "properties": { "rho": 7850, "E": 200e9 } } },
      { "op": "createCustomFunction", "fn": { "name": "...", "tag": "engineering", "inputs": [{ "id": "x", "label": "X" }], "formula": "x^2" } },
      { "op": "createGroup", "nodeIds": ["ai_node_1", "ai_node_2"], "label": "Inputs", "color": "#1CABB0" }
    ]
  }
}`
}

// ── Validation ──────────────────────────────────────────────────────────────

interface AiResponse {
  mode: string
  message: string
  thinking?: string
  assumptions: string[]
  risk: { level: string; reasons: string[] }
  patch: { ops: unknown[] }
  explanation?: Record<string, unknown>
  template?: Record<string, unknown>
  theme?: Record<string, unknown>
}

function validateAiResponse(raw: unknown): AiResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  if (typeof obj.message !== 'string') return null
  if (!Array.isArray(obj.assumptions)) obj.assumptions = []
  if (!obj.risk || typeof obj.risk !== 'object') {
    obj.risk = { level: 'low', reasons: [] }
  }
  const risk = obj.risk as Record<string, unknown>
  if (!['low', 'medium', 'high'].includes(risk.level as string)) {
    risk.level = 'low'
  }
  if (!Array.isArray(risk.reasons)) risk.reasons = []

  if (!obj.patch || typeof obj.patch !== 'object') {
    obj.patch = { ops: [] }
  }
  const patch = obj.patch as Record<string, unknown>
  if (!Array.isArray(patch.ops)) patch.ops = []

  // Allow thinking field to pass through
  if (typeof obj.thinking === 'string') {
    // keep it
  } else {
    delete obj.thinking
  }

  return obj as unknown as AiResponse
}

// ── OpenAI call ─────────────────────────────────────────────────────────────

interface OpenAiUsage {
  input_tokens: number
  output_tokens: number
}

interface OpenAiResponse {
  id: string
  output: Array<{ type: string; content: Array<{ type: string; text: string }> }>
  usage: OpenAiUsage
}

async function callOpenAi(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<{ parsed: AiResponse; usage: OpenAiUsage; responseId: string }> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      text: { format: { type: 'json_object' } },
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`OpenAI API error ${res.status}: ${errBody.slice(0, 200)}`)
  }

  const data = (await res.json()) as OpenAiResponse
  const outputText = data.output?.[0]?.content?.[0]?.text ?? '{}'
  let parsed: unknown
  try {
    parsed = JSON.parse(outputText)
  } catch {
    parsed = null
  }

  let validated = validateAiResponse(parsed)

  // One repair round if invalid
  if (!validated) {
    const repairRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
          { role: 'assistant', content: outputText },
          {
            role: 'user',
            content:
              'Your previous response was not valid JSON matching the schema. Please return ONLY the corrected JSON with no extra text.',
          },
        ],
        text: { format: { type: 'json_object' } },
      }),
    })

    if (repairRes.ok) {
      const repairData = (await repairRes.json()) as OpenAiResponse
      const repairText = repairData.output?.[0]?.content?.[0]?.text ?? '{}'
      try {
        const repairParsed = JSON.parse(repairText)
        validated = validateAiResponse(repairParsed)
      } catch {
        // Still invalid after repair
      }
      // Add repair usage
      data.usage.input_tokens += repairData.usage?.input_tokens ?? 0
      data.usage.output_tokens += repairData.usage?.output_tokens ?? 0
    }

    if (!validated) {
      throw new Error('AI returned invalid JSON even after repair')
    }
  }

  return { parsed: validated, usage: data.usage, responseId: data.id }
}

// ── 6.05: Streaming OpenAI call ──────────────────────────────────────────

/**
 * Call OpenAI with streaming enabled. Returns a ReadableStream of SSE events
 * that forwards text deltas and ends with a `done` event containing the
 * parsed structured response.
 */
async function callOpenAiStreaming(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  streamMeta?: { task: AiTask; tokenLimit: number; currentTokens: number },
): Promise<{ stream: ReadableStream<Uint8Array>; getUsage: () => Promise<OpenAiUsage> }> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      store: false,
      stream: true,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      text: { format: { type: 'json_object' } },
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`OpenAI API error ${res.status}: ${errBody.slice(0, 200)}`)
  }

  const encoder = new TextEncoder()
  let fullText = ''
  let usage: OpenAiUsage = { input_tokens: 0, output_tokens: 0 }
  let usageResolve: (u: OpenAiUsage) => void
  const usagePromise = new Promise<OpenAiUsage>((resolve) => {
    usageResolve = resolve
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            // Parse the accumulated JSON and send the final response
            let parsed = validateAiResponse(safeJsonParse(fullText))
            if (!parsed) {
              // Try to repair with a non-streaming call
              try {
                const repair = await callOpenAi(apiKey, model, systemPrompt, userMessage)
                parsed = repair.parsed
                usage = {
                  input_tokens: usage.input_tokens + repair.usage.input_tokens,
                  output_tokens: usage.output_tokens + repair.usage.output_tokens,
                }
              } catch {
                parsed = {
                  mode: 'plan',
                  message: fullText || 'AI returned invalid JSON',
                  assumptions: [],
                  risk: { level: 'low', reasons: [] },
                  patch: { ops: [] },
                }
              }
            }

            // Transform the internal AiResponse into the public AiApiResponse
            // shape so the client reads patchOps (not patch.ops), ok:true, etc.
            const tokensIn = usage.input_tokens ?? 0
            const tokensOut = usage.output_tokens ?? 0
            const apiResponse = {
              ok: true as const,
              task: streamMeta?.task ?? 'chat',
              message: parsed.message,
              ...(parsed.thinking ? { thinking: parsed.thinking } : {}),
              assumptions: parsed.assumptions ?? [],
              risk: parsed.risk ?? { level: 'low', reasons: [] },
              patchOps: parsed.patch?.ops ?? [],
              usage: { tokensIn, tokensOut },
              tokensRemaining: streamMeta
                ? Math.max(
                    0,
                    streamMeta.tokenLimit - streamMeta.currentTokens - tokensIn - tokensOut,
                  )
                : undefined,
              ...(parsed.explanation ? { explanation: parsed.explanation } : {}),
              ...(parsed.template ? { template: parsed.template } : {}),
              ...(parsed.theme ? { theme: parsed.theme } : {}),
            }
            const doneEvent = JSON.stringify({ type: 'done', response: apiResponse })
            controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            usageResolve!(usage)
            return
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ') && !line.startsWith('event: ')) continue
            if (line.startsWith('event: ')) continue

            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const event = JSON.parse(data) as Record<string, unknown>
              const eventType = event.type as string | undefined

              // OpenAI Responses API streaming events
              if (eventType === 'response.output_text.delta') {
                const delta = (event.delta as string) ?? ''
                fullText += delta
                const sseData = JSON.stringify({ type: 'delta', text: delta })
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
              } else if (eventType === 'response.completed') {
                const resp = event.response as Record<string, unknown> | undefined
                if (resp?.usage) {
                  usage = resp.usage as OpenAiUsage
                }
              }
            } catch {
              // Skip unparseable events
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        const errEvent = JSON.stringify({ type: 'error', error: msg })
        controller.enqueue(encoder.encode(`data: ${errEvent}\n\n`))
        controller.close()
        usageResolve!(usage)
      }
    },
  })

  return { stream, getUsage: () => usagePromise }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const reqId = crypto.randomUUID().slice(0, 8)

  try {
    const { OPEN_AI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env
    const model = context.env.AI_MODEL ?? 'o3'

    if (!OPEN_AI_API_KEY) {
      console.error(`[ai ${reqId}] Missing OPEN_AI_API_KEY`)
      return jsonError('AI service not configured', 503)
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[ai ${reqId}] Missing Supabase config`)
      return jsonError('Server configuration error', 500)
    }

    // ── Parse body ────────────────────────────────────────────────────────
    let body: AiRequestBody
    try {
      body = (await context.request.json()) as AiRequestBody
    } catch {
      return jsonError('Invalid JSON body', 400)
    }

    if (!body.mode || !['plan', 'edit', 'bypass'].includes(body.mode)) {
      return jsonError('Invalid mode', 400)
    }
    if (!body.userMessage || typeof body.userMessage !== 'string') {
      return jsonError('Missing userMessage', 400)
    }
    if (body.userMessage.length > MAX_PROMPT_LENGTH) {
      return jsonError(`Message too long (max ${MAX_PROMPT_LENGTH} chars)`, 400)
    }
    if (!body.projectId || !body.canvasId) {
      return jsonError('Missing projectId or canvasId', 400)
    }

    const task: AiTask = VALID_TASKS.includes(body.task as AiTask) ? (body.task as AiTask) : 'chat'

    // ── Auth ──────────────────────────────────────────────────────────────
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const authHeader = context.request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return jsonError('Missing Authorization Bearer token', 401)

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return jsonError('Authentication failed', 401)
    }
    const userId = userData.user.id

    // ── Plan check ────────────────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id,plan,is_developer,is_admin')
      .eq('id', userId)
      .maybeSingle()

    // E2-6: Developer/admin accounts bypass plan restrictions
    const isDev = !!(profile as Record<string, unknown> | null)?.is_developer
    const isAdm = !!(profile as Record<string, unknown> | null)?.is_admin
    const plan: Plan = isDev || isAdm ? 'enterprise' : ((profile?.plan as Plan) ?? 'free')

    if (plan === 'free' || plan === 'past_due' || plan === 'canceled') {
      return jsonError('ChainSolve AI requires a Pro or Enterprise subscription', 402)
    }

    // ── Resolve org for enterprise ────────────────────────────────────────
    let orgId: string | null = null
    let enterpriseBypassAllowed = false
    let tokenLimit = PRO_MONTHLY_TOKEN_LIMIT
    let aiEnabled = true
    let allowedModes: string[] = ['plan', 'edit', 'bypass']

    if (plan === 'enterprise') {
      const { data: membership } = await supabaseAdmin
        .from('org_members')
        .select('org_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      if (membership?.org_id) {
        orgId = membership.org_id

        const { data: policy } = await supabaseAdmin
          .from('ai_org_policies')
          .select('allow_bypass,monthly_token_limit_per_seat,ai_enabled,ai_allowed_modes')
          .eq('org_id', orgId)
          .maybeSingle()

        if (policy) {
          enterpriseBypassAllowed = policy.allow_bypass ?? false
          tokenLimit = policy.monthly_token_limit_per_seat ?? ENTERPRISE_DEFAULT_TOKEN_LIMIT
          aiEnabled = policy.ai_enabled ?? true
          allowedModes = Array.isArray(policy.ai_allowed_modes)
            ? policy.ai_allowed_modes
            : ['plan', 'edit', 'bypass']
        } else {
          tokenLimit = ENTERPRISE_DEFAULT_TOKEN_LIMIT
        }
      }
    }

    // Enterprise org disabled AI entirely
    if (!aiEnabled) {
      return Response.json(
        { ok: false, error: 'ChainSolve AI is disabled by your organization', code: 'AI_DISABLED' },
        { status: 403 },
      )
    }

    // Mode not allowed by org policy
    if (!allowedModes.includes(body.mode)) {
      // Downgrade to the most permissive allowed mode
      if (allowedModes.includes('edit')) body.mode = 'edit'
      else if (allowedModes.includes('plan')) body.mode = 'plan'
      else {
        return Response.json(
          { ok: false, error: 'No AI modes allowed by your organization', code: 'MODE_BLOCKED' },
          { status: 403 },
        )
      }
    }

    // Bypass mode requires enterprise policy
    if (body.mode === 'bypass' && plan !== 'enterprise') {
      body.mode = 'edit'
    }
    if (body.mode === 'bypass' && !enterpriseBypassAllowed) {
      body.mode = 'edit'
    }

    // Explain task forces plan mode (read-only)
    if (task === 'explain_node') {
      body.mode = 'plan'
    }

    // ── Quota check ───────────────────────────────────────────────────────
    const now = new Date()
    const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`

    const { data: usage } = await supabaseAdmin
      .from('ai_usage_monthly')
      .select('id,tokens_in,tokens_out')
      .eq('owner_id', userId)
      .eq('period_start', periodStart)
      .maybeSingle()

    const currentTokens = (usage?.tokens_in ?? 0) + (usage?.tokens_out ?? 0)
    if (currentTokens >= tokenLimit) {
      return Response.json(
        {
          ok: false,
          error: 'Monthly AI token quota exceeded',
          code: 'QUOTA_EXCEEDED',
          tokensRemaining: 0,
        },
        { status: 402 },
      )
    }

    // ── Hourly rate limit (SEC-02): max 50 requests/hour per user ─────────
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const { count: hourlyCount } = await supabaseAdmin
      .from('ai_request_log')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .gte('created_at', oneHourAgo)

    const HOURLY_REQUEST_LIMIT = 50
    if ((hourlyCount ?? 0) >= HOURLY_REQUEST_LIMIT) {
      // Log rate-limit hit for observability
      supabaseAdmin
        .from('observability_events')
        .insert({
          ts: now.toISOString(),
          env: 'production',
          event_type: 'rate_limit_hit',
          user_id: userId,
          payload: {
            endpoint: '/api/ai',
            limit: HOURLY_REQUEST_LIMIT,
            window: '1h',
            count: hourlyCount,
          },
        })
        .then(
          () => {
            /* fire-and-forget */
          },
          () => {
            /* non-fatal */
          },
        )

      const retryAfter = 3600 - Math.floor((now.getTime() - new Date(oneHourAgo).getTime()) / 1000)
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Too many AI requests. Maximum 50 requests per hour.',
          code: 'RATE_LIMITED',
          retryAfterSeconds: retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
          },
        },
      )
    }

    // ── 6.07: Daily request limit by plan tier ─────────────────────────────
    const DAILY_LIMITS: Record<Plan, number> = {
      free: 0,
      student: 10,
      trialing: 100,
      pro: 100,
      enterprise: 1000,
      past_due: 0,
      canceled: 0,
    }
    // Developer/admin accounts (resolved to 'enterprise' above) are unlimited
    const dailyLimit = isDev || isAdm ? Infinity : (DAILY_LIMITS[plan] ?? 0)

    if (dailyLimit !== Infinity) {
      const todayStart = new Date(now)
      todayStart.setUTCHours(0, 0, 0, 0)
      const { count: dailyCount } = await supabaseAdmin
        .from('ai_request_log')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .gte('created_at', todayStart.toISOString())

      if ((dailyCount ?? 0) >= dailyLimit) {
        return Response.json(
          {
            ok: false,
            error:
              dailyLimit === 0
                ? 'ChainSolve AI requires a Pro or Enterprise subscription'
                : `Daily AI request limit reached (${dailyLimit}/day). Resets at midnight UTC.`,
            code: 'DAILY_LIMIT',
            dailyLimit,
            dailyUsed: dailyCount ?? 0,
          },
          { status: 429 },
        )
      }
    }

    // ── Fetch canvas context ──────────────────────────────────────────────
    let contextSummary = ''
    try {
      const { data: canvas } = await supabaseAdmin
        .from('canvases')
        .select('storage_path')
        .eq('id', body.canvasId)
        .eq('owner_id', userId)
        .maybeSingle()

      if (canvas?.storage_path) {
        const { data: fileData } = await supabaseAdmin.storage
          .from('projects')
          .download(canvas.storage_path)

        if (fileData) {
          const text = await fileData.text()
          const canvasJson = JSON.parse(text) as {
            nodes?: Array<{ id: string; data?: Record<string, unknown> }>
            edges?: Array<{ id: string; source: string; target: string; targetHandle?: string }>
          }

          const nodes = canvasJson.nodes ?? []
          const edges = canvasJson.edges ?? []

          // If selection scope, filter to selected + 1 hop neighbors
          let relevantNodes = nodes
          let relevantEdges = edges
          if (
            body.scope === 'selection' &&
            Array.isArray(body.selectedNodeIds) &&
            body.selectedNodeIds.length > 0
          ) {
            const selectedSet = new Set(body.selectedNodeIds)
            for (const e of edges) {
              if (selectedSet.has(e.source)) selectedSet.add(e.target)
              if (selectedSet.has(e.target)) selectedSet.add(e.source)
            }
            relevantNodes = nodes.filter((n) => selectedSet.has(n.id))
            relevantEdges = edges.filter(
              (e) => selectedSet.has(e.source) && selectedSet.has(e.target),
            )
          }

          // 6.02: Merge client-side computed values into node summaries
          const cv = body.clientContext?.computedValues ?? {}

          // Build compact summary
          const nodeSummaries = relevantNodes
            .slice(0, 50)
            .map((n) => {
              const d = n.data as Record<string, unknown> | undefined
              const computed = cv[n.id]
              const computedStr =
                computed !== undefined
                  ? typeof computed === 'string'
                    ? ` ERROR="${computed}"`
                    : ` => ${computed}`
                  : ''
              return `${n.id}: ${d?.blockType ?? '?'}${d?.label ? ` "${d.label}"` : ''}${d?.value !== undefined ? ` val=${d.value}` : ''}${computedStr}`
            })
            .join('\n')

          const edgeSummaries = relevantEdges
            .slice(0, 50)
            .map((e) => `${e.source} -> ${e.target}:${e.targetHandle ?? 'value'}`)
            .join('\n')

          contextSummary = `\nCurrent canvas (${nodes.length} nodes, ${edges.length} edges):\nNODES:\n${nodeSummaries}\nEDGES:\n${edgeSummaries}`

          if (relevantNodes.length < nodes.length) {
            contextSummary += `\n(Showing ${relevantNodes.length} of ${nodes.length} nodes)`
          }
        }
      }
    } catch {
      contextSummary = '\n(Canvas context unavailable)'
    }

    // Append diagnostics to context if provided
    if (body.clientContext?.diagnostics?.length) {
      const diagSummary = body.clientContext.diagnostics
        .slice(0, 20)
        .map(
          (d) =>
            `[${d.level}] ${d.code}: ${d.message}${d.nodeIds?.length ? ` (nodes: ${d.nodeIds.join(',')})` : ''}`,
        )
        .join('\n')
      contextSummary += `\n\nDIAGNOSTICS:\n${diagSummary}`
    }

    // ── Call OpenAI ───────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(body.mode, task)
    const userPrompt = `${body.userMessage}${contextSummary}`

    // ── 6.05: Streaming path ────────────────────────────────────────────
    if (body.stream) {
      const { stream, getUsage } = await callOpenAiStreaming(
        OPEN_AI_API_KEY,
        model,
        systemPrompt,
        userPrompt,
        { task, tokenLimit, currentTokens },
      )

      // Fire-and-forget: update quota and log after stream completes
      void getUsage().then(async (streamUsage) => {
        const tokensIn = streamUsage.input_tokens ?? 0
        const tokensOut = streamUsage.output_tokens ?? 0
        try {
          if (usage?.id) {
            await supabaseAdmin
              .from('ai_usage_monthly')
              .update({
                tokens_in: (usage.tokens_in ?? 0) + tokensIn,
                tokens_out: (usage.tokens_out ?? 0) + tokensOut,
                requests: ((usage as Record<string, unknown>).requests as number) + 1,
                last_request_at: now.toISOString(),
              })
              .eq('id', usage.id)
          } else {
            await supabaseAdmin.from('ai_usage_monthly').insert({
              owner_id: userId,
              org_id: orgId,
              period_start: periodStart,
              tokens_in: tokensIn,
              tokens_out: tokensOut,
              requests: 1,
              last_request_at: now.toISOString(),
            })
          }
          await supabaseAdmin.from('ai_request_log').insert({
            owner_id: userId,
            org_id: orgId,
            mode: body.mode,
            task,
            model,
            tokens_in: tokensIn,
            tokens_out: tokensOut,
            ops_count: 0, // Not easily available in streaming path
            risk_level: 'low',
            response_id: `stream-${reqId}`,
          })
        } catch {
          // Non-fatal: quota/log update failure
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // ── Non-streaming path ──────────────────────────────────────────────
    const {
      parsed,
      usage: aiUsage,
      responseId,
    } = await callOpenAi(OPEN_AI_API_KEY, model, systemPrompt, userPrompt)

    const tokensIn = aiUsage.input_tokens ?? 0
    const tokensOut = aiUsage.output_tokens ?? 0
    const tokensRemaining = Math.max(0, tokenLimit - currentTokens - tokensIn - tokensOut)

    // ── Update quota ──────────────────────────────────────────────────────
    if (usage?.id) {
      await supabaseAdmin
        .from('ai_usage_monthly')
        .update({
          tokens_in: (usage.tokens_in ?? 0) + tokensIn,
          tokens_out: (usage.tokens_out ?? 0) + tokensOut,
          requests: ((usage as Record<string, unknown>).requests as number) + 1,
          last_request_at: now.toISOString(),
        })
        .eq('id', usage.id)
    } else {
      await supabaseAdmin.from('ai_usage_monthly').insert({
        owner_id: userId,
        org_id: orgId,
        period_start: periodStart,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        requests: 1,
        last_request_at: now.toISOString(),
      })
    }

    // ── Log request metadata (NO content) ─────────────────────────────────
    const opsCount = Array.isArray(parsed.patch?.ops) ? parsed.patch.ops.length : 0
    await supabaseAdmin.from('ai_request_log').insert({
      owner_id: userId,
      org_id: orgId,
      mode: body.mode,
      task,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      ops_count: opsCount,
      risk_level: parsed.risk?.level ?? 'low',
      response_id: responseId,
    })

    // ── Return response ───────────────────────────────────────────────────
    const response: Record<string, unknown> = {
      ok: true,
      task,
      message: parsed.message,
      assumptions: parsed.assumptions ?? [],
      risk: parsed.risk ?? { level: 'low', reasons: [] },
      patchOps: parsed.patch?.ops ?? [],
      usage: { tokensIn, tokensOut },
      tokensRemaining,
      dailyLimit: dailyLimit === Infinity ? null : dailyLimit,
    }

    // Include extra fields for specific tasks
    if (parsed.thinking) response.thinking = parsed.thinking
    if (parsed.explanation) response.explanation = parsed.explanation
    if (parsed.template) response.template = parsed.template
    if (parsed.theme) response.theme = parsed.theme

    return Response.json(response)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error(`[ai ${reqId}]`, err)
    return jsonError(msg, 500)
  }
}
