//座標の定義
// -zが正面, zが後ろ、　xが正面から右向き　yが上

export interface Vector3{
    x: number;
    y:number;
    z: number;
}

// azimuth：水平方向の角度。正面0°、右90°、後方180°、左270°。
// elevation：上下方向の角度。水平0°、真上90°、真下−90°。
// distance：音源までの距離。
//座標変換は次の式に統一

/*
x rcos(θ)sin(θ)
y rsin(Φ)
z -rcos(Φ)cos(θ)
*/

//θが azimuth、Φ が elevation
//ただし　2次元でやるつもりなのでΦ=0として扱う

//直交座標から球面座標への変換関数
export const sphericalToCartesian=(azimuthDeg: number,
  elevationDeg: number,
  distance: number) :Vector3=>{
    const si_ta =azimuthDeg *Math.PI/180
    const fai = elevationDeg * Math.PI / 180;

    return {
        x: distance*Math.cos(fai)*Math.sin(si_ta),
        y: distance*Math.sin(fai),
        z: -distance*Math.cos(fai)*Math.cos(si_ta),
    };


};