import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <link rel="preload" href="/fonts/inter.css" as="style" />
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Hide content until styles are loaded */
            body {
              visibility: hidden;
            }
          `
        }} />
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{
          __html: `
            // Show content when styles are loaded
            document.body.style.visibility = 'visible';
          `
        }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}