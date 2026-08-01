declare module "open-location-code" {
  export function encode(latitude: number, longitude: number): string;
  export function decode(code: string): {
    latitudeLo: number;
    longitudeLo: number;
    latitudeHi: number;
    longitudeHi: number;
    latitudeCenter: number;
    longitudeCenter: number;
    codeLength: number;
  };
}
