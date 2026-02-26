//! Convenience binary to regenerate golden fixture expected outputs.
//!
//! Usage: `cargo run -p engine-core --bin update_goldens`
//!
//! This is equivalent to running:
//!   `GOLDEN_UPDATE=1 cargo test -p engine-core --test golden`

fn main() {
    std::env::set_var("GOLDEN_UPDATE", "1");

    let status = std::process::Command::new("cargo")
        .args(["test", "-p", "engine-core", "--test", "golden", "--", "--nocapture"])
        .status()
        .expect("Failed to run cargo test");

    if !status.success() {
        std::process::exit(1);
    }
}
