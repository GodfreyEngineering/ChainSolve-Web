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
    description: 'Computes the FFT magnitude spectrum of input vector y. Returns |FFT[k]| for k = 0 .. N/2 (first N/2+1 bins). Input is zero-padded to the next power of 2.',
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
    description: 'Computes the FFT power spectrum of input vector y. Returns |FFT[k]|^2 / N for k = 0 .. N/2.',
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
    description: 'Windowed-sinc FIR lowpass filter. cutoff_norm is the normalized cutoff frequency (0 to 0.5 = Nyquist). taps must be an odd integer >= 3.',
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
    description: 'Windowed-sinc FIR highpass filter via spectral inversion. cutoff_norm is the normalized cutoff frequency (0 to 0.5 = Nyquist). taps must be an odd integer >= 3.',
  })
}
