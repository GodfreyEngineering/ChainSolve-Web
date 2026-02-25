use std::fmt;

/// Machine-readable error codes emitted by the engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCode {
    /// Snapshot version is unsupported.
    UnsupportedVersion,
    /// An edge references a node id that does not exist.
    DanglingEdge,
    /// The graph contains one or more cycles.
    CycleDetected,
    /// A block type is not recognised by the engine.
    UnknownBlock,
    /// A required input port has no value.
    MissingInput,
    /// Deserialization of the snapshot JSON failed.
    InvalidSnapshot,
}

impl ErrorCode {
    pub fn as_str(&self) -> &'static str {
        match self {
            ErrorCode::UnsupportedVersion => "UNSUPPORTED_VERSION",
            ErrorCode::DanglingEdge => "DANGLING_EDGE",
            ErrorCode::CycleDetected => "CYCLE_DETECTED",
            ErrorCode::UnknownBlock => "UNKNOWN_BLOCK",
            ErrorCode::MissingInput => "MISSING_INPUT",
            ErrorCode::InvalidSnapshot => "INVALID_SNAPSHOT",
        }
    }
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Top-level engine error (returned from public API).
#[derive(Debug, Clone)]
pub struct EngineError {
    pub code: ErrorCode,
    pub message: String,
}

impl fmt::Display for EngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for EngineError {}

impl EngineError {
    pub fn new(code: ErrorCode, msg: impl Into<String>) -> Self {
        Self { code, message: msg.into() }
    }
}
