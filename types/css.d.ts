// types/css.d.ts
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module 'leaflet/dist/leaflet.css';