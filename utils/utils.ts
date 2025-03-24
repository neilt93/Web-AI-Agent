// ./utils/utils.ts

export async function waitForEnter(message: string = 'Press Enter to continue...') {
  console.log(`\n[⏸️] ${message}`);
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });
}
