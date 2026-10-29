
const DEG = Math.PI / 180;

export function wrapAngle(angle: number): number {
    return ((angle + 540) % 360) - 180;
}

export type PhoneDirection = {
    heading: number | null;
    elevation: number;
    horizontalStrength: number;
};

export function getPhoneDirection(
    event: DeviceOrientationEvent
): PhoneDirection | null {
    const { alpha, beta, gamma } = event;

    if (
        alpha == null ||
        beta == null ||
        gamma == null ||
        !Number.isFinite(alpha) ||
        !Number.isFinite(beta) ||
        !Number.isFinite(gamma)
    ) {
        return null;
    }

    const a = alpha * DEG;
    const b = beta * DEG;
    const g = gamma * DEG;

    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const cb = Math.cos(b);
    const sb = Math.sin(b);
    const cg = Math.cos(g);
    const sg = Math.sin(g);

    // スマホの画面裏側方向 (-Z)
    const backX = -ca * sg - sa * sb * cg;
    const backY = -sa * sg + ca * sb * cg;
    const backZ = -cb * cg;

    // スマホの上端方向 (+Y)
    const topX = -cb * sa;
    const topY = cb * ca;
    const topZ = sb;

    // 2つの方向を合成
    // 縦持ちでも水平持ちでも水平方位を得やすくする
    const x = backX + topX;
    const y = backY + topY;
    const z = backZ + topZ;

    const horizontal = Math.hypot(x, y);

    // ベクトルの長さは√2
    const horizontalStrength =
        horizontal / Math.SQRT2;

    // 水平方位
    const heading =
        horizontalStrength < 0.1
            ? null
            : Math.atan2(x, y) / DEG;

    // 合成した方向の仰角
    const elevation =
        Math.atan2(z, horizontal) / DEG;

    return {
        heading,
        elevation,
        horizontalStrength,
    };
}

// 旧コードとの互換性
export function getPhoneHeading(
    event: DeviceOrientationEvent
): number | null {
    return getPhoneDirection(event)?.heading ?? null;
}
