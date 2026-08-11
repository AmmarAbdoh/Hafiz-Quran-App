interface AudioContextFixture {
  AudioContextMock: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  oscillator: {
    frequency: {
      setValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    type: OscillatorType;
  };
  gain: {
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
  };
}

function createAudioContextFixture(): AudioContextFixture {
  const oscillator = {
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    type: "sine" as OscillatorType,
  };
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  const createOscillator = vi.fn(() => oscillator);
  const createGain = vi.fn(() => gain);
  const AudioContextMock = vi.fn(function AudioContextMock() {
    return {
      currentTime: 10,
      destination: { id: "destination" },
      createOscillator,
      createGain,
    };
  });

  return {
    AudioContextMock,
    createOscillator,
    createGain,
    oscillator,
    gain,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("playWrongSound", () => {
  it("plays a short descending cue and reuses its audio context", async () => {
    const fixture = createAudioContextFixture();
    vi.stubGlobal("AudioContext", fixture.AudioContextMock);
    const { playWrongSound } = await import("./playWrongSound");

    playWrongSound();
    playWrongSound();

    expect(fixture.AudioContextMock).toHaveBeenCalledOnce();
    expect(fixture.createOscillator).toHaveBeenCalledTimes(2);
    expect(fixture.createGain).toHaveBeenCalledTimes(2);
    expect(fixture.oscillator.type).toBe("square");
    expect(fixture.oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(
      180,
      10,
    );
    expect(
      fixture.oscillator.frequency.exponentialRampToValueAtTime,
    ).toHaveBeenCalledWith(90, 10.18);
    expect(fixture.gain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 10);
    expect(fixture.oscillator.start).toHaveBeenCalledWith(10);
    expect(fixture.oscillator.stop).toHaveBeenCalledWith(10.24);
  });

  it("ignores browsers that block audio creation", async () => {
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function BlockedAudioContext() {
        throw new Error("blocked");
      }),
    );
    const { playWrongSound } = await import("./playWrongSound");

    expect(() => playWrongSound()).not.toThrow();
  });
});
