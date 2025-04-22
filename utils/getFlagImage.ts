// utils/getFlagImage.ts
import { countryNameToCode } from './CountryCodes';

export const getFlagImageUrl = (
  countryName: string,
  size: number = 24
): string | null => {
  const code = countryNameToCode[countryName];
  return code ? `https://flagcdn.com/w${20}/${code.toLowerCase()}.png` : null;
};
