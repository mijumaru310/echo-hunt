//捕捉範囲
const captureRange: number = 5;

//敵が捕捉範囲内にいるかを判定する関数
export function isInCaptureRange(relAngle: number): boolean {
    const diff: number = Math.abs(relAngle);
    return diff <= captureRange;
}

console.log(isInCaptureRange(0));   // true
console.log(isInCaptureRange(5));   // true
console.log(isInCaptureRange(-5));  // true
console.log(isInCaptureRange(6));   // false
console.log(isInCaptureRange(-6));  // false