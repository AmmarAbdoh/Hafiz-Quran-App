interface AudioFocusOwner {
  stop: () => void;
}

let currentOwner: AudioFocusOwner | null = null;

export function claimAudioFocus(owner: AudioFocusOwner): void {
  if (currentOwner && currentOwner !== owner) {
    currentOwner.stop();
  }
  currentOwner = owner;
}

export function releaseAudioFocus(owner: AudioFocusOwner): void {
  if (currentOwner === owner) {
    currentOwner = null;
  }
}
