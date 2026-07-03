import { useEffect } from 'react';

export default function SupportButton() {
  useEffect(() => {
    const existingScript = document.querySelector(
      'script[data-name="bmc-button"]',
    );

    if (existingScript) return;

    const script = document.createElement('script');

    script.type = 'text/javascript';
    script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js';
    script.setAttribute('data-name', 'bmc-button');
    script.setAttribute('data-slug', 'MustachioSystems');
    script.setAttribute('data-color', '#5F7FFF');
    script.setAttribute('data-emoji', '');
    script.setAttribute('data-font', 'Cookie');
    script.setAttribute('data-text', 'Buy the dev a Coffee');
    script.setAttribute('data-outline-color', '#000000');
    script.setAttribute('data-font-color', '#ffffff');
    script.setAttribute('data-coffee-color', '#FFDD00');

    document.body.appendChild(script);

    return () => {
      script.remove();

      // The Buy Me a Coffee widget injects its own element into the page.
      // Remove it when React changes pages so duplicates do not appear.
      document
        .querySelectorAll('[id^="bmc-wbtn"]')
        .forEach((element) => element.remove());
    };
  }, []);

  return null;
}