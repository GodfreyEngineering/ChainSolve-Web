# Page snapshot

```yaml
- generic [ref=e2]:
  - heading "Engine failed to load" [level=2] [ref=e3]
  - code [ref=e5]: WASM_INIT_FAILED
  - paragraph [ref=e6]: The compute engine could not initialize. This may be caused by a browser extension blocking WebAssembly or a network issue.
  - code [ref=e7]: "[WASM_INIT_FAILED] r.get_constant_values is not a function"
  - generic [ref=e8]:
    - button "Retry" [ref=e9] [cursor=pointer]
    - link "Reload page" [ref=e10] [cursor=pointer]:
      - /url: /
```