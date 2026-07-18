export type ScannerOwnedStream = {
  getTracks(): Array<{ stop(): void }>;
};

export type ScannerVideoTarget = {
  srcObject: unknown;
};

export function createScannerLifecycle() {
  let generation = 0;
  let navigationTaken = false;
  let ownedStream: ScannerOwnedStream | null = null;
  let ownedVideo: ScannerVideoTarget | null = null;
  let cancelSchedule: (() => void) | null = null;

  function releaseOwnedResources() {
    cancelSchedule?.();
    cancelSchedule = null;
    for (const track of ownedStream?.getTracks() ?? []) track.stop();
    if (ownedVideo) ownedVideo.srcObject = null;
    ownedStream = null;
    ownedVideo = null;
  }

  return {
    begin() {
      releaseOwnedResources();
      generation += 1;
      navigationTaken = false;
      return generation;
    },
    cancel() {
      releaseOwnedResources();
      generation += 1;
      navigationTaken = false;
    },
    isCurrent(session: number) {
      return session === generation;
    },
    navigateOnce(session: number) {
      if (session !== generation || navigationTaken) return false;
      navigationTaken = true;
      return true;
    },
    ownSchedule(session: number, cancel: () => void) {
      if (session !== generation) {
        cancel();
        return false;
      }
      cancelSchedule?.();
      cancelSchedule = cancel;
      return true;
    },
    ownStream(
      session: number,
      stream: ScannerOwnedStream,
      video: ScannerVideoTarget,
    ) {
      if (session !== generation) {
        for (const track of stream.getTracks()) track.stop();
        video.srcObject = null;
        return false;
      }
      releaseOwnedResources();
      ownedStream = stream;
      ownedVideo = video;
      return true;
    },
    release(session: number) {
      if (session !== generation) return false;
      releaseOwnedResources();
      return true;
    },
  };
}
