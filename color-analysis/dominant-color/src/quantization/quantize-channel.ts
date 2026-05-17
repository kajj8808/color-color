export function quantizeChannel(value: number, bucketSize: number) {
  return Math.floor(value / bucketSize) * bucketSize;
}
