import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechInput } from '../../hooks/useSpeechInput';

class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  started = false;
  stopped = false;

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }

  start() {
    this.started = true;
  }

  stop() {
    this.stopped = true;
  }
}

type WindowWithSpeech = Window & { SpeechRecognition?: unknown };

describe('useSpeechInput', () => {
  beforeEach(() => {
    FakeSpeechRecognition.instances = [];
    (window as WindowWithSpeech).SpeechRecognition = FakeSpeechRecognition;
  });

  afterEach(() => {
    delete (window as WindowWithSpeech).SpeechRecognition;
  });

  it('reports supported when a SpeechRecognition constructor exists', () => {
    const { result } = renderHook(() => useSpeechInput(vi.fn()));
    expect(result.current.supported).toBe(true);
  });

  it('reports unsupported when no constructor exists', () => {
    delete (window as WindowWithSpeech).SpeechRecognition;
    const { result } = renderHook(() => useSpeechInput(vi.fn()));
    expect(result.current.supported).toBe(false);
  });

  it('starts listening and delivers the joined transcript', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscript));

    act(() => result.current.startListening());
    expect(result.current.listening).toBe(true);

    const recognition = FakeSpeechRecognition.instances[0];
    expect(recognition.started).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.lang).toBe('en-US');

    act(() => {
      recognition.onresult?.({
        results: [[{ transcript: 'a smoky ' }], [{ transcript: 'mezcal drink' }]],
      });
    });
    expect(onTranscript).toHaveBeenCalledWith('a smoky mezcal drink');
  });

  it('stops listening when recognition ends on its own', () => {
    const { result } = renderHook(() => useSpeechInput(vi.fn()));
    act(() => result.current.startListening());
    act(() => FakeSpeechRecognition.instances[0].onend?.());
    expect(result.current.listening).toBe(false);
  });

  it('stopListening stops the active recognition', () => {
    const { result } = renderHook(() => useSpeechInput(vi.fn()));
    act(() => result.current.startListening());
    act(() => result.current.stopListening());
    expect(FakeSpeechRecognition.instances[0].stopped).toBe(true);
    expect(result.current.listening).toBe(false);
  });
});
