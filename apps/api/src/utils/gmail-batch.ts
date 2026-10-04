/** Fetch Gmail thread metadata in parallel waves (one HTTP call per thread, grouped for locality). */
export async function fetchInWaves<T, R>(
  items: T[],
  waveSize: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const waves: T[][] = [];
  for (let offset = 0; offset < items.length; offset += waveSize) {
    waves.push(items.slice(offset, offset + waveSize));
  }

  return waves.reduce(async (prevPromise, wave, waveIdx) => {
    const acc = await prevPromise;
    const waveResults = await Promise.all(
      wave.map((item, index) => worker(item, waveIdx * waveSize + index)),
    );
    return acc.concat(waveResults);
  }, Promise.resolve<R[]>([]));
}
