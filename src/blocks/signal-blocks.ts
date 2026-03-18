/**
 * signal-blocks.ts — FFT and Signal Processing block pack (SCI-12).
 *
 * 9 blocks: FFT magnitude/power spectrum, frequency bins, window functions,
 * and FIR filters. Evaluation handled by Rust/WASM engine ops (signal.* namespace).
 */

import type { BlockDef } from './types'

export function registerSignalBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'signal.fft_magnitude',
    label: 'FFT Magnitude',
    category: 'signal',
    nodeKind: 'csOperation',
    inputs: [{ id: 'y', label: 'y (vector)' }],
    defaultData: { blockType: 'signal.fft_magnitude', label: 'FFT Magnitude' },
    synonyms: ['fft', 'fast fourier transform', 'magnitude spectrum', 'frequency spectrum'],
    tags: ['signal', 'fft', 'frequency'],
    description:
      'Computes the FFT magnitude spectrum of input vector y. Returns |FFT[k]| for k = 0 .. N/2 (first N/2+1 bins). Input is zero-padded to the next power of 2.',
  })

  register({
    type: 'signal.fft_power',
    label: 'FFT Power',
    category: 'signal',
    nodeKind: 'csOperation',
    inputs: [{ id: 'y', label: 'y (vector)' }],
    defaultData: { blockType: 'signal.fft_power', label: 'FFT Power' },
    synonyms: ['power spectrum', 'psd', 'power spectral density', 'fft power'],
    tags: ['signal', 'fft', 'frequency'],
    description:
      'Computes the FFT power spectrum of input vector y. Returns |FFT[k]|^2 / N for k = 0 .. N/2.',
  })

  register({
    type: 'signal.fft_freq_bins',
    label: 'FFT Freq Bins',
    category: 'signal',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'n', label: 'N (samples)' },
      { id: 'sample_rate', label: 'fs (Hz)' },
    ],
    defaultData: { blockType: 'signal.fft_freq_bins', label: 'FFT Freq Bins' },
    synonyms: ['frequency bins', 'fft frequencies', 'bin frequencies'],
    tags: ['signal', 'fft', 'frequency'],
    description: 'Returns the frequency (Hz) for each FFT bin: k * fs / N for k = 0 .. N/2.',
  })

  register({
    type: 'signal.window_hann',
    label: 'Hann Window',
    category: 'signal',
    nodeKind: 'csOperation',
    inputs: [{ id: 'n', label: 'N (length)' }],
    defaultData: { blockType: 'signal.window_hann', label: 'Hann Window' },
    synonyms: ['hanning window', 'hann', 'window function'],
    tags: ['signal', 'window'],
    description: 'Generates a Hann (raised cosine) window of length N.',
  })

  register({
    type: 'signal.window_hamming',
    label: 'Hamming Window',
    category: 'signal',
    nodeKind: 'csOperation',
    inputs: [{ id: 'n', label: 'N (length)' }],
    defaultData: { blockType: 'signal.window_hamming', label: 'Hamming Window' },
    synonyms: ['hamming', 'window function'],
    tags: ['signal', 'window'],
    description: 'Generates a Hamming window of length N.',
  })

  register({
    type: 'signal.window_blackman',
    label: 'Blackman Window',
    category: 'signal',
    nodeKind: 'csOperation',
    inputs: [{ id: 'n', label: 'N (length)' }],
    defaultData: { blockType: 'signal.window_blackman', label: 'Blackman Window' },
    synonyms: ['blackman', 'window function'],
    tags: ['signal', 'window'],
    description: 'Generates a Blackman window of length N.',
  })

  register({
    type: 'signal.filter_lowpass_fir',
    label: 'Lowpass FIR',
    category: 'signal',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'y', label: 'y (vector)' },
      { id: 'cutoff_norm', label: 'fc (0..0.5)' },
      { id: 'taps', label: 'Taps (odd)' },
    ],
    defaultData: { blockType: 'signal.filter_lowpass_fir', label: 'Lowpass FIR' },
    synonyms: ['low pass filter', 'fir filter', 'lowpass', 'smoothing filter'],
    tags: ['signal', 'filter', 'fir'],
    description:
      'Windowed-sinc FIR lowpass filter. cutoff_norm is the normalized cutoff frequency (0 to 0.5 = Nyquist). taps must be an odd integer >= 3.',
  })

  register({
    type: 'signal.filter_highpass_fir',
    label: 'Highpass FIR',
    category: 'signal',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'y', label: 'y (vector)' },
      { id: 'cutoff_norm', label: 'fc (0..0.5)' },
      { id: 'taps', label: 'Taps (odd)' },
    ],
    defaultData: { blockType: 'signal.filter_highpass_fir', label: 'Highpass FIR' },
    synonyms: ['high pass filter', 'fir filter', 'highpass'],
    tags: ['signal', 'filter', 'fir'],
    description:
      'Windowed-sinc FIR highpass filter via spectral inversion. cutoff_norm is the normalized cutoff frequency (0 to 0.5 = Nyquist). taps must be an odd integer >= 3.',
  })

  // ── IIR Filter Design ────────────────────────────────────────

  register({
    type: 'signal.filter_butter',
    label: 'Butterworth IIR Filter',
    category: 'signal',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'y', label: 'Signal' },
      { id: 'cutoff', label: 'Cutoff (0-1)' },
    ],
    defaultData: {
      blockType: 'signal.filter_butter',
      label: 'Butterworth IIR Filter',
      order: 4,
      pass: 'lowpass',
      zeroPhaseBool: false,
    },
    synonyms: ['butterworth', 'IIR filter', 'lowpass IIR', 'highpass IIR'],
    tags: ['signal', 'filter', 'iir', 'butterworth'],
    description:
      'Digital Butterworth IIR filter (maximally flat magnitude). Set order (1-8), pass (lowpass/highpass), and optional zeroPhaseBool in block settings. Cutoff is normalised 0-1 (1 = Nyquist). More selective than FIR for same order.',
  })

  register({
    type: 'signal.filter_cheby1',
    label: 'Chebyshev I IIR Filter',
    category: 'signal',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'y', label: 'Signal' },
      { id: 'cutoff', label: 'Cutoff (0-1)' },
    ],
    defaultData: {
      blockType: 'signal.filter_cheby1',
      label: 'Chebyshev I IIR Filter',
      order: 4,
      rippleDb: 0.5,
      pass: 'lowpass',
      zeroPhaseBool: false,
    },
    synonyms: ['chebyshev', 'cheby1', 'IIR filter', 'equiripple'],
    tags: ['signal', 'filter', 'iir', 'chebyshev'],
    description:
      'Chebyshev Type I IIR filter — equal ripple in the passband, steeper roll-off than Butterworth. Set order (1-8), rippleDb (passband ripple), and pass type in block settings.',
  })

  register({
    type: 'signal.filter_zero_phase',
    label: 'Zero-Phase Filter',
    category: 'signal',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'y', label: 'Signal' },
      { id: 'cutoff', label: 'Cutoff (0-1)' },
    ],
    defaultData: {
      blockType: 'signal.filter_zero_phase',
      label: 'Zero-Phase Filter',
      order: 4,
      pass: 'lowpass',
    },
    synonyms: ['zero phase', 'filtfilt', 'forward backward filter', 'acausal'],
    tags: ['signal', 'filter', 'iir', 'zero-phase'],
    description:
      'Forward-backward Butterworth IIR filter with zero phase shift. Applies the filter twice (once forward, once backward). Effective order is doubled. Ideal for offline signal processing where phase matters.',
  })
}
