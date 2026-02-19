import * as fs from 'fs';
import * as path from 'path';
import { test as base } from '@playwright/test';
import { Tutorial } from './tutorial';
import { mergeAudioWithVideo } from './audio-merger';

export type TestOptions = {
  /** Whether tutorial highlights are active. Driven by TUTORIAL=1 env var. */
  tutorial: boolean;
  /** Pre-constructed Tutorial instance with automatic audio-video merge on teardown. */
  tutorialObj: Tutorial;
};

export const test = base.extend<TestOptions>({
  tutorial: [!!process.env.TUTORIAL, { option: true }],

  tutorialObj: async ({ page, tutorial: tutorialActive }, use, testInfo) => {
    const tut = new Tutorial(page, tutorialActive);
    tut.setStartTime(Date.now());
    await use(tut);

    // Teardown: merge audio chunks into the recorded video if applicable
    const chunks = tut.getAudioChunks();
    const isEdgeTts = process.env.TTS === 'edge-tts';
    if (!tutorialActive || !isEdgeTts || chunks.length === 0) return;

    const video = page.video();
    if (!video) return;

    try {
      // Close page to stop recording, then saveAs() to wait for full flush
      await page.close();
      const dir = path.dirname(testInfo.outputPath(''));
      const videoPath = path.join(dir, 'video-complete.webm');
      await video.saveAs(videoPath);
      const outputPath = path.join(dir, 'video-narrated.webm');
      mergeAudioWithVideo(videoPath, chunks, outputPath);
      await testInfo.attach('narrated-video', {
        path: outputPath,
        contentType: 'video/webm',
      });
      // Clean up intermediate files
      fs.unlinkSync(videoPath);
      fs.unlinkSync(outputPath);
    } catch (err) {
      console.warn('[tutorial] Failed to merge audio into video:', err);
    }
  },
});

export { expect } from '@playwright/test';
