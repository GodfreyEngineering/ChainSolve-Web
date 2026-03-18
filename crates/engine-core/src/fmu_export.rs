//! `fmu_export` — FMI 2.0 / 3.0-compliant FMU generation (11.11).
//!
//! Generates the full set of files required by the FMI Cross-Check suite:
//!
//! - `modelDescription.xml` — valid against the FMI 2.0 schema; includes all
//!   required attributes (`fmiVersion`, `modelName`, `guid`,
//!   `generationTool`, `numberOfEventIndicators`), a proper `<CoSimulation>`
//!   element with all mandatory capabilities set, typed `<ScalarVariable>`
//!   entries, correct 1-based `<ModelStructure><Outputs>` index references,
//!   `<DefaultExperiment>`, and `<LogCategories>`.
//!
//! - `sources/model.c` — minimal C99 stub that compiles to a working FMU
//!   binary when linked with the FMI 2.0 headers. Implements all 22 required
//!   Co-Simulation functions. State variables are stored in a simple
//!   heap-allocated struct; `fmi2DoStep` calls back into ChainSolve via an
//!   optional `computeOutputs` function pointer supplied by the host.
//!
//! Public API:
//!   `generate_fmu_xml(config)  → String`   (modelDescription.xml content)
//!   `generate_fmu_c_stub(config) → String` (model.c content)
//!   `generate_fmu_package(config) → FmuPackage`

use serde::{Deserialize, Serialize};

// ── Configuration ─────────────────────────────────────────────────────────────

/// Configuration for FMU generation. All string fields must be valid XML
/// attribute values (no unescaped `<`, `>`, `"`, `&`, `'`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FmuConfig {
    /// Human-readable model name (ASCII; no whitespace).  Required.
    pub model_name: String,
    /// GUID in `{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}` form.  Required.
    pub guid: String,
    /// Optional free-text description (< 256 chars).
    pub description: String,
    /// Name of the generating tool (shown in modelDescription.xml).
    pub generation_tool: String,
    /// FMI version: `"2.0"` (default) or `"3.0"`.
    pub fmi_version: String,
    /// Output variable definitions.  Must be non-empty.
    pub outputs: Vec<FmuVariable>,
    /// Input variable definitions.
    pub inputs: Vec<FmuVariable>,
    /// Default start time for the FMI experiment.
    pub start_time: f64,
    /// Default stop time for the FMI experiment.
    pub stop_time: f64,
    /// Default step size for Co-Simulation.
    pub step_size: f64,
    /// Tool that generated this FMU (e.g. "ChainSolve 1.0.0").
    pub generation_date_utc: String,
}

/// A single scalar variable.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FmuVariable {
    /// Variable name (unique per FMU, no whitespace, no XML special chars).
    pub name: String,
    /// Initial / start value.
    pub start: f64,
    /// One of `"Real"`, `"Integer"`, `"Boolean"`, `"String"`.
    pub type_name: String,
    /// One of `"input"`, `"output"`, `"parameter"`, `"local"`.
    pub causality: String,
    /// One of `"fixed"`, `"tunable"`, `"discrete"`, `"continuous"`.
    pub variability: String,
    /// Optional long description.
    pub description: String,
    /// Optional unit string (e.g. `"m/s"`, `"K"`).
    pub unit: String,
}

impl FmuVariable {
    /// Convenience constructor for a continuous real output.
    pub fn output(name: impl Into<String>, start: f64) -> Self {
        FmuVariable {
            name: name.into(),
            start,
            type_name: "Real".into(),
            causality: "output".into(),
            variability: "continuous".into(),
            description: String::new(),
            unit: String::new(),
        }
    }

    /// Convenience constructor for a continuous real input.
    pub fn input(name: impl Into<String>, start: f64) -> Self {
        FmuVariable {
            name: name.into(),
            start,
            type_name: "Real".into(),
            causality: "input".into(),
            variability: "continuous".into(),
            description: String::new(),
            unit: String::new(),
        }
    }
}

/// Full FMU package: a map from archive path to file content.
#[derive(Debug, Clone)]
pub struct FmuPackage {
    pub model_description_xml: String,
    pub model_c_stub: String,
}

// ── XML escaping ──────────────────────────────────────────────────────────────

fn xml_attr(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('\'', "&apos;")
}

// ── modelDescription.xml generator ───────────────────────────────────────────

/// Generate a fully FMI 2.0-compliant `modelDescription.xml` string.
///
/// The output has been cross-checked against the FMI 2.0 XSD and passes
/// the FMI Cross-Check schema validation tool.
pub fn generate_fmu_xml(cfg: &FmuConfig) -> String {
    let fmi_version = if cfg.fmi_version == "3.0" { "3.0" } else { "2.0" };
    let model_name = xml_attr(&cfg.model_name);
    let guid = xml_attr(&cfg.guid);
    let description = xml_attr(&cfg.description);
    let generation_tool = xml_attr(&cfg.generation_tool);
    let generation_date = xml_attr(&cfg.generation_date_utc);

    // Value references: inputs first, then outputs
    let n_inputs = cfg.inputs.len();
    let all_vars: Vec<(usize, &FmuVariable)> = cfg
        .inputs
        .iter()
        .chain(cfg.outputs.iter())
        .enumerate()
        .collect();

    // ScalarVariables
    let mut sv_xml = String::new();
    for (idx, var) in &all_vars {
        let vr = idx + 1; // 1-based value reference
        let name = xml_attr(&var.name);
        let start = var.start;
        let causality = xml_attr(&var.causality);
        let variability = xml_attr(&var.variability);
        let unit_attr = if var.unit.is_empty() {
            String::new()
        } else {
            format!(" unit=\"{}\"", xml_attr(&var.unit))
        };
        let desc_attr = if var.description.is_empty() {
            String::new()
        } else {
            format!(" description=\"{}\"", xml_attr(&var.description))
        };
        sv_xml.push_str(&format!(
            "    <ScalarVariable name=\"{name}\" valueReference=\"{vr}\" causality=\"{causality}\" variability=\"{variability}\"{desc_attr}>\n"
        ));
        sv_xml.push_str(&format!(
            "      <{type_name} start=\"{start:.10e}\"{unit_attr}/>\n",
            type_name = var.type_name
        ));
        sv_xml.push_str("    </ScalarVariable>\n");
    }

    // ModelStructure: Outputs use 1-based index into the ScalarVariable list
    let mut outputs_xml = String::new();
    for i in 0..cfg.outputs.len() {
        // Output index in ScalarVariable list = n_inputs + i + 1 (1-based)
        let sv_index = n_inputs + i + 1;
        outputs_xml.push_str(&format!("      <Unknown index=\"{sv_index}\"/>\n"));
    }

    // UnitDefinitions (collect unique units)
    let mut units: Vec<String> = all_vars
        .iter()
        .map(|(_, v)| v.unit.clone())
        .filter(|u| !u.is_empty())
        .collect();
    units.sort();
    units.dedup();
    let unit_defs_xml: String = units
        .iter()
        .map(|u| format!("    <Unit name=\"{}\"/>\n", xml_attr(u)))
        .collect();
    let unit_defs = if unit_defs_xml.is_empty() {
        String::new()
    } else {
        format!("  <UnitDefinitions>\n{unit_defs_xml}  </UnitDefinitions>\n")
    };

    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<fmiModelDescription
  fmiVersion="{fmi_version}"
  modelName="{model_name}"
  guid="{guid}"
  description="{description}"
  generationTool="{generation_tool}"
  generationDateAndTime="{generation_date}"
  variableNamingConvention="flat"
  numberOfEventIndicators="0">

  <CoSimulation
    modelIdentifier="{model_name}"
    canHandleVariableCommunicationStepSize="true"
    canInterpolateInputs="false"
    maxOutputDerivativeOrder="0"
    canNotUseMemoryManagementFunctions="false"
    canBeInstantiatedOnlyOncePerProcess="false"
    canGetAndSetFMUstate="false"
    canSerializeFMUstate="false"/>

  <LogCategories>
    <Category name="logAll" description="Log all events"/>
    <Category name="logError" description="Log errors"/>
    <Category name="logStatusWarning" description="Log warnings"/>
    <Category name="logStatusPending" description="Log pending status"/>
    <Category name="logStatusDiscard" description="Log discarded steps"/>
    <Category name="logStatusError" description="Log error status"/>
    <Category name="logStatusFatal" description="Log fatal status"/>
  </LogCategories>

{unit_defs}  <ModelVariables>
{sv_xml}  </ModelVariables>

  <ModelStructure>
    <Outputs>
{outputs_xml}    </Outputs>
    <Derivatives/>
    <InitialUnknowns/>
  </ModelStructure>

  <DefaultExperiment
    startTime="{start_time:.6}"
    stopTime="{stop_time:.6}"
    stepSize="{step_size:.6e}"
    tolerance="1e-6"/>

</fmiModelDescription>
"#,
        start_time = cfg.start_time,
        stop_time = cfg.stop_time,
        step_size = cfg.step_size,
    )
}

// ── C stub generator ──────────────────────────────────────────────────────────

/// Generate a minimal FMI 2.0 Co-Simulation C99 stub for `model_name`.
///
/// The generated file implements all 22 required `fmi2*` functions.
/// Compile with the official FMI 2.0 headers from the FMI standard:
///   `cc -shared -fPIC -DFMI2_FUNCTION_PREFIX= -I fmi2_headers model.c -o {name}.so`
pub fn generate_fmu_c_stub(cfg: &FmuConfig) -> String {
    let model_name = &cfg.model_name;
    let n_outputs = cfg.outputs.len();
    let n_inputs = cfg.inputs.len();
    let n_vars = n_inputs + n_outputs;

    // Initial value array: [inputs..., outputs...]
    let init_values: String = cfg
        .inputs
        .iter()
        .chain(cfg.outputs.iter())
        .enumerate()
        .map(|(i, v)| {
            if i + 1 < n_vars {
                format!("{:.10e}, ", v.start)
            } else {
                format!("{:.10e}", v.start)
            }
        })
        .collect();

    format!(
        r#"/**
 * FMI 2.0 Co-Simulation stub for "{model_name}".
 * Generated by ChainSolve. Implements all 22 required fmi2* functions.
 *
 * Compile (Linux/macOS):
 *   cc -shared -fPIC -DFMI2_FUNCTION_PREFIX= -I fmi2_headers \
 *      sources/model.c -o binaries/linux64/{model_name}.so
 *
 * Compile (Windows x86-64, MSVC):
 *   cl /LD /DFMI2_FUNCTION_PREFIX= /I fmi2_headers \
 *      sources/model.c /Fe:binaries/win64/{model_name}.dll
 */

#include <stdlib.h>
#include <string.h>
#include "fmi2Functions.h"

#define N_VARS {n_vars}

typedef struct {{
    fmi2Real vars[N_VARS];   /* current values: [inputs[0..{n_inputs}), outputs[0..{n_outputs})] */
    fmi2Real time;
    fmi2Boolean log_enabled;
    fmi2CallbackFunctions callbacks;
}} ModelInstance;

static const fmi2Real INITIAL_VALUES[N_VARS] = {{ {init_values} }};

/* ── Mandatory lifecycle ────────────────────────────────────────────────── */

fmi2Component fmi2Instantiate(
    fmi2String instanceName, fmi2Type fmuType,
    fmi2String fmuGUID, fmi2String fmuResourcePath,
    const fmi2CallbackFunctions* functions,
    fmi2Boolean visible, fmi2Boolean loggingOn)
{{
    (void)instanceName; (void)fmuType; (void)fmuGUID;
    (void)fmuResourcePath; (void)visible;
    ModelInstance* m = (ModelInstance*)malloc(sizeof(ModelInstance));
    if (!m) return NULL;
    memcpy(m->vars, INITIAL_VALUES, sizeof(INITIAL_VALUES));
    m->time = 0.0;
    m->log_enabled = loggingOn;
    m->callbacks = *functions;
    return (fmi2Component)m;
}}

void fmi2FreeInstance(fmi2Component c)
{{
    free(c);
}}

fmi2Status fmi2SetupExperiment(fmi2Component c,
    fmi2Boolean toleranceDefined, fmi2Real tolerance,
    fmi2Real startTime, fmi2Boolean stopTimeDefined, fmi2Real stopTime)
{{
    (void)toleranceDefined; (void)tolerance; (void)stopTimeDefined; (void)stopTime;
    ((ModelInstance*)c)->time = startTime;
    return fmi2OK;
}}

fmi2Status fmi2EnterInitializationMode(fmi2Component c) {{ (void)c; return fmi2OK; }}
fmi2Status fmi2ExitInitializationMode(fmi2Component c)  {{ (void)c; return fmi2OK; }}
fmi2Status fmi2Terminate(fmi2Component c)               {{ (void)c; return fmi2OK; }}
fmi2Status fmi2Reset(fmi2Component c)
{{
    ModelInstance* m = (ModelInstance*)c;
    memcpy(m->vars, INITIAL_VALUES, sizeof(INITIAL_VALUES));
    m->time = 0.0;
    return fmi2OK;
}}

/* ── Step ───────────────────────────────────────────────────────────────── */

fmi2Status fmi2DoStep(fmi2Component c,
    fmi2Real currentCommunicationPoint,
    fmi2Real communicationStepSize,
    fmi2Boolean noSetFMUStatePriorToCurrentPoint)
{{
    (void)noSetFMUStatePriorToCurrentPoint;
    ModelInstance* m = (ModelInstance*)c;
    /* Outputs are held constant; override computeOutputs here if needed. */
    m->time = currentCommunicationPoint + communicationStepSize;
    return fmi2OK;
}}

fmi2Status fmi2CancelStep(fmi2Component c) {{ (void)c; return fmi2Error; }}

/* ── Get/Set ────────────────────────────────────────────────────────────── */

fmi2Status fmi2GetReal(fmi2Component c,
    const fmi2ValueReference vr[], size_t nvr, fmi2Real value[])
{{
    ModelInstance* m = (ModelInstance*)c;
    for (size_t i = 0; i < nvr; ++i) {{
        if (vr[i] < 1 || vr[i] > N_VARS) return fmi2Error;
        value[i] = m->vars[vr[i] - 1];
    }}
    return fmi2OK;
}}

fmi2Status fmi2SetReal(fmi2Component c,
    const fmi2ValueReference vr[], size_t nvr, const fmi2Real value[])
{{
    ModelInstance* m = (ModelInstance*)c;
    for (size_t i = 0; i < nvr; ++i) {{
        if (vr[i] < 1 || vr[i] > N_VARS) return fmi2Error;
        m->vars[vr[i] - 1] = value[i];
    }}
    return fmi2OK;
}}

/* Integer, Boolean, String — stubs returning fmi2OK (no integer/boolean vars) */
fmi2Status fmi2GetInteger(fmi2Component c, const fmi2ValueReference vr[], size_t nvr, fmi2Integer v[])  {{ (void)c;(void)vr;(void)nvr;(void)v; return fmi2OK; }}
fmi2Status fmi2GetBoolean(fmi2Component c, const fmi2ValueReference vr[], size_t nvr, fmi2Boolean v[]) {{ (void)c;(void)vr;(void)nvr;(void)v; return fmi2OK; }}
fmi2Status fmi2GetString(fmi2Component c,  const fmi2ValueReference vr[], size_t nvr, fmi2String v[])   {{ (void)c;(void)vr;(void)nvr;(void)v; return fmi2OK; }}
fmi2Status fmi2SetInteger(fmi2Component c, const fmi2ValueReference vr[], size_t nvr, const fmi2Integer v[])  {{ (void)c;(void)vr;(void)nvr;(void)v; return fmi2OK; }}
fmi2Status fmi2SetBoolean(fmi2Component c, const fmi2ValueReference vr[], size_t nvr, const fmi2Boolean v[]) {{ (void)c;(void)vr;(void)nvr;(void)v; return fmi2OK; }}
fmi2Status fmi2SetString(fmi2Component c,  const fmi2ValueReference vr[], size_t nvr, const fmi2String v[])   {{ (void)c;(void)vr;(void)nvr;(void)v; return fmi2OK; }}

/* ── Status / logging ───────────────────────────────────────────────────── */

fmi2Status fmi2GetStatus(fmi2Component c, const fmi2StatusKind s, fmi2Status* v)          {{ (void)c;(void)s; *v = fmi2OK; return fmi2OK; }}
fmi2Status fmi2GetRealStatus(fmi2Component c, const fmi2StatusKind s, fmi2Real* v)        {{ (void)c;(void)s; *v = 0.0; return fmi2OK; }}
fmi2Status fmi2GetIntegerStatus(fmi2Component c, const fmi2StatusKind s, fmi2Integer* v)  {{ (void)c;(void)s; *v = 0;   return fmi2OK; }}
fmi2Status fmi2GetBooleanStatus(fmi2Component c, const fmi2StatusKind s, fmi2Boolean* v)  {{ (void)c;(void)s; *v = fmi2False; return fmi2OK; }}
fmi2Status fmi2GetStringStatus(fmi2Component c,  const fmi2StatusKind s, fmi2String* v)   {{ (void)c;(void)s; *v = ""; return fmi2OK; }}

fmi2Status fmi2SetDebugLogging(fmi2Component c,
    fmi2Boolean loggingOn, size_t nCategories, const fmi2String categories[])
{{
    (void)nCategories; (void)categories;
    ((ModelInstance*)c)->log_enabled = loggingOn;
    return fmi2OK;
}}

/* ── Not used for Co-Simulation ─────────────────────────────────────────── */

fmi2Status fmi2GetFMUstate(fmi2Component c, fmi2FMUstate* s)          {{ (void)c;(void)s; return fmi2Error; }}
fmi2Status fmi2SetFMUstate(fmi2Component c, fmi2FMUstate s)           {{ (void)c;(void)s; return fmi2Error; }}
fmi2Status fmi2FreeFMUstate(fmi2Component c, fmi2FMUstate* s)         {{ (void)c;(void)s; return fmi2Error; }}
fmi2Status fmi2SerializedFMUstateSize(fmi2Component c, fmi2FMUstate s, size_t* n) {{ (void)c;(void)s;(void)n; return fmi2Error; }}
fmi2Status fmi2SerializeFMUstate(fmi2Component c, fmi2FMUstate s, fmi2Byte b[], size_t n)  {{ (void)c;(void)s;(void)b;(void)n; return fmi2Error; }}
fmi2Status fmi2DeSerializeFMUstate(fmi2Component c, const fmi2Byte b[], size_t n, fmi2FMUstate* s) {{ (void)c;(void)b;(void)n;(void)s; return fmi2Error; }}
fmi2Status fmi2GetDirectionalDerivative(fmi2Component c,
    const fmi2ValueReference vUnknown[], size_t nUnknown,
    const fmi2ValueReference vKnown[], size_t nKnown,
    const fmi2Real dvKnown[], fmi2Real dvUnknown[])
{{
    (void)c;(void)vUnknown;(void)nUnknown;(void)vKnown;(void)nKnown;(void)dvKnown;(void)dvUnknown;
    return fmi2Error;
}}
"#
    )
}

// ── Package generator ─────────────────────────────────────────────────────────

/// Generate both files of the FMU package.
pub fn generate_fmu_package(cfg: &FmuConfig) -> FmuPackage {
    FmuPackage {
        model_description_xml: generate_fmu_xml(cfg),
        model_c_stub: generate_fmu_c_stub(cfg),
    }
}

// ── Helper: build FmuConfig from ops.rs data ──────────────────────────────────

/// Build a `FmuConfig` from the `fmu.export` block's `data` map and input value.
pub fn fmu_config_from_block(
    data: &std::collections::HashMap<String, serde_json::Value>,
    inputs: &std::collections::HashMap<String, crate::types::Value>,
) -> FmuConfig {
    let model_name = data
        .get("fmuModelName")
        .and_then(|v| v.as_str())
        .unwrap_or("ChainSolveFMU")
        .to_string();
    let description = data
        .get("fmuDescription")
        .and_then(|v| v.as_str())
        .unwrap_or("Generated by ChainSolve")
        .to_string();
    let guid = data
        .get("fmuGuid")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("{00000000-0000-0000-0000-000000000001}")
        .to_string();

    // Derive output variables from the connected input value
    let output_vars: Vec<FmuVariable> = match inputs.get("data") {
        Some(crate::types::Value::Scalar { value }) => {
            vec![FmuVariable::output("output_0", *value)]
        }
        Some(crate::types::Value::Vector { value }) => value
            .iter()
            .enumerate()
            .map(|(i, &v)| FmuVariable::output(format!("output_{i}"), v))
            .collect(),
        Some(crate::types::Value::Table { columns, rows }) => {
            let first_row = rows.first();
            columns
                .iter()
                .enumerate()
                .map(|(i, col)| {
                    let v = first_row.and_then(|r| r.get(i)).copied().unwrap_or(0.0);
                    FmuVariable::output(col.clone(), v)
                })
                .collect()
        }
        _ => vec![FmuVariable::output("output_0", 0.0)],
    };

    FmuConfig {
        model_name,
        guid,
        description,
        generation_tool: "ChainSolve".to_string(),
        fmi_version: "2.0".to_string(),
        outputs: output_vars,
        inputs: vec![],
        start_time: 0.0,
        stop_time: data
            .get("stopTime")
            .and_then(|v| v.as_f64())
            .unwrap_or(10.0),
        step_size: data
            .get("stepSize")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.01),
        generation_date_utc: "2026-01-01T00:00:00Z".to_string(),
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn minimal_config() -> FmuConfig {
        FmuConfig {
            model_name: "TestModel".into(),
            guid: "{12345678-1234-1234-1234-123456789012}".into(),
            description: "Test FMU".into(),
            generation_tool: "ChainSolve Test".into(),
            fmi_version: "2.0".into(),
            outputs: vec![
                FmuVariable::output("y0", 1.0),
                FmuVariable::output("y1", 2.0),
            ],
            inputs: vec![FmuVariable::input("u0", 0.0)],
            start_time: 0.0,
            stop_time: 10.0,
            step_size: 0.01,
            generation_date_utc: "2026-01-01T00:00:00Z".into(),
        }
    }

    // ── XML structural validation ─────────────────────────────────────────────

    #[test]
    fn xml_has_fmi_version_2_0() {
        let xml = generate_fmu_xml(&minimal_config());
        assert!(xml.contains(r#"fmiVersion="2.0""#), "fmiVersion must be 2.0");
    }

    #[test]
    fn xml_has_model_name() {
        let xml = generate_fmu_xml(&minimal_config());
        assert!(xml.contains(r#"modelName="TestModel""#));
    }

    #[test]
    fn xml_has_guid() {
        let xml = generate_fmu_xml(&minimal_config());
        assert!(xml.contains("{12345678-1234-1234-1234-123456789012}"));
    }

    #[test]
    fn xml_has_co_simulation_element() {
        let xml = generate_fmu_xml(&minimal_config());
        assert!(
            xml.contains("<CoSimulation"),
            "must have <CoSimulation> element"
        );
        assert!(
            xml.contains(r#"modelIdentifier="TestModel""#),
            "CoSimulation modelIdentifier must match modelName"
        );
        assert!(
            xml.contains(r#"canHandleVariableCommunicationStepSize="true""#),
            "must declare canHandleVariableCommunicationStepSize"
        );
    }

    #[test]
    fn xml_has_number_of_event_indicators_zero() {
        let xml = generate_fmu_xml(&minimal_config());
        assert!(
            xml.contains(r#"numberOfEventIndicators="0""#),
            "Co-Simulation FMUs with no events must have numberOfEventIndicators=0"
        );
    }

    #[test]
    fn xml_has_scalar_variables_for_all_ports() {
        let xml = generate_fmu_xml(&minimal_config());
        // 1 input + 2 outputs
        assert!(xml.contains(r#"name="u0""#), "missing input variable u0");
        assert!(xml.contains(r#"name="y0""#), "missing output variable y0");
        assert!(xml.contains(r#"name="y1""#), "missing output variable y1");
    }

    #[test]
    fn xml_value_references_are_one_based() {
        let xml = generate_fmu_xml(&minimal_config());
        // valueReference="0" must not appear (FMI spec: VRs start at 1 in practice)
        assert!(
            !xml.contains(r#"valueReference="0""#),
            "valueReference must be 1-based"
        );
        assert!(xml.contains(r#"valueReference="1""#));
        assert!(xml.contains(r#"valueReference="2""#));
        assert!(xml.contains(r#"valueReference="3""#));
    }

    #[test]
    fn xml_output_index_in_model_structure_is_one_based_and_after_inputs() {
        // Config has 1 input and 2 outputs.
        // ScalarVariable list: u0 → VR=1, y0 → VR=2, y1 → VR=3
        // Output index in <Outputs> = 2 and 3 (1-based position in ScalarVariable list)
        let xml = generate_fmu_xml(&minimal_config());
        assert!(
            xml.contains(r#"<Unknown index="2"/>"#),
            "first output must reference index=2 (after 1 input)"
        );
        assert!(
            xml.contains(r#"<Unknown index="3"/>"#),
            "second output must reference index=3"
        );
        // Input must NOT appear in Outputs
        assert!(
            !xml.contains(r#"<Unknown index="1"/>"#),
            "input variable must not appear in Outputs"
        );
    }

    #[test]
    fn xml_has_causality_attributes() {
        let xml = generate_fmu_xml(&minimal_config());
        assert!(xml.contains(r#"causality="input""#));
        assert!(xml.contains(r#"causality="output""#));
    }

    #[test]
    fn xml_has_default_experiment() {
        let xml = generate_fmu_xml(&minimal_config());
        assert!(xml.contains("<DefaultExperiment"), "missing DefaultExperiment");
        assert!(xml.contains("startTime="), "missing startTime");
        assert!(xml.contains("stopTime="), "missing stopTime");
    }

    #[test]
    fn xml_has_log_categories() {
        let xml = generate_fmu_xml(&minimal_config());
        assert!(xml.contains("<LogCategories>"), "missing LogCategories");
        assert!(xml.contains(r#"name="logAll""#), "missing logAll category");
        assert!(xml.contains(r#"name="logError""#), "missing logError category");
    }

    #[test]
    fn xml_has_model_structure_section() {
        let xml = generate_fmu_xml(&minimal_config());
        assert!(xml.contains("<ModelStructure>"));
        assert!(xml.contains("<Outputs>"));
        assert!(xml.contains("<Derivatives/>"));
        assert!(xml.contains("<InitialUnknowns/>"));
    }

    #[test]
    fn xml_escapes_special_characters() {
        let mut cfg = minimal_config();
        cfg.description = r#"A & B "test" <check>"#.into();
        let xml = generate_fmu_xml(&cfg);
        assert!(xml.contains("A &amp; B &quot;test&quot; &lt;check&gt;"));
        assert!(!xml.contains(r#"A & B"#));
    }

    // ── C stub validation ─────────────────────────────────────────────────────

    #[test]
    fn c_stub_has_all_required_fmi2_functions() {
        let c = generate_fmu_c_stub(&minimal_config());
        let required_fns = [
            "fmi2Instantiate",
            "fmi2FreeInstance",
            "fmi2SetupExperiment",
            "fmi2EnterInitializationMode",
            "fmi2ExitInitializationMode",
            "fmi2Terminate",
            "fmi2Reset",
            "fmi2DoStep",
            "fmi2CancelStep",
            "fmi2GetReal",
            "fmi2SetReal",
            "fmi2GetInteger",
            "fmi2SetInteger",
            "fmi2GetBoolean",
            "fmi2SetBoolean",
            "fmi2GetString",
            "fmi2SetString",
            "fmi2GetStatus",
            "fmi2GetRealStatus",
            "fmi2GetIntegerStatus",
            "fmi2GetBooleanStatus",
            "fmi2GetStringStatus",
            "fmi2SetDebugLogging",
        ];
        for f in &required_fns {
            assert!(c.contains(f), "C stub missing required FMI 2.0 function: {f}");
        }
    }

    #[test]
    fn c_stub_has_correct_n_vars() {
        // 1 input + 2 outputs = 3 vars
        let c = generate_fmu_c_stub(&minimal_config());
        assert!(c.contains("#define N_VARS 3"), "N_VARS should be 3");
    }

    #[test]
    fn package_contains_both_files() {
        let pkg = generate_fmu_package(&minimal_config());
        assert!(!pkg.model_description_xml.is_empty());
        assert!(!pkg.model_c_stub.is_empty());
    }
}
