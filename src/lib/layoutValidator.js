/**
 * ID Card Layout Validator
 * Verifies layout alignment, boundaries, text clipping, and overlapping elements
 */

export const validateCardLayout = (cardEl, cardW, cardH) => {
  const warnings = [];
  const errors = [];

  if (!cardEl) {
    errors.push('Card element not found.');
    return { valid: false, errors, warnings };
  }

  const cardRect = cardEl.getBoundingClientRect();
  if (cardRect.width === 0 || cardRect.height === 0) {
    errors.push('Card has zero dimensions (not rendered/hidden).');
    return { valid: false, errors, warnings };
  }

  // Find all field elements
  // Fields in our system are marked with key attributes or are positioned absolutely/flex
  // We can query all elements that represent fields
  const elements = Array.from(cardEl.querySelectorAll('div, span, img'));
  const fields = [];

  elements.forEach((el) => {
    // Check for text node content
    const hasText = Array.from(el.childNodes).some(
      node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
    );

    if (hasText || el.tagName === 'IMG' || el.tagName === 'CANVAS') {
      const rect = el.getBoundingClientRect();
      const relLeft = rect.left - cardRect.left;
      const relTop = rect.top - cardRect.top;
      const relRight = rect.right - cardRect.left;
      const relBottom = rect.bottom - cardRect.top;
      const text = el.textContent.trim();
      const tag = el.tagName;

      // Classify as field if it's absolutely positioned or is a direct flex item inside flow container
      const style = window.getComputedStyle(el);
      const isAbsolute = style.position === 'absolute';
      const isFlexChild = el.parentElement && window.getComputedStyle(el.parentElement).display === 'flex';

      if (isAbsolute || isFlexChild) {
        fields.push({
          element: el,
          text,
          tag,
          rect: {
            left: relLeft,
            top: relTop,
            right: relRight,
            bottom: relBottom,
            width: rect.width,
            height: rect.height
          }
        });
      }
    }
  });

  // 1. Check Boundaries & Overflows
  fields.forEach(f => {
    // Allow a small tolerance of 3px
    if (f.rect.right > cardW + 3) {
      warnings.push(`Horizontal Overflow: "${f.text || f.tag}" extends beyond the right edge of the card.`);
    }
    if (f.rect.left < -3) {
      warnings.push(`Horizontal Overflow: "${f.text || f.tag}" extends beyond the left edge of the card.`);
    }

    // Bottom margin check (reserving space for barcode/footer)
    const footerZone = cardH - 45;
    if (f.rect.bottom > cardH + 3) {
      warnings.push(`Vertical Overflow: "${f.text || f.tag}" extends beyond the bottom edge of the card.`);
    } else if (f.rect.bottom > footerZone) {
      // Check if it's a standard field (not a footer text itself)
      const isFooterElement = f.text.includes('Nagpur') || f.text.includes('74,') || f.text.match(/^\d{10}$/);
      if (!isFooterElement && f.rect.top < footerZone) {
        warnings.push(`Footer Overlap: "${f.text || f.tag}" overlaps with the barcode/footer zone.`);
      }
    }

    // 2. Check Text Clipping (scrollHeight > clientHeight)
    if (f.tag !== 'IMG' && f.tag !== 'CANVAS') {
      const el = f.element;
      if (el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) {
        warnings.push(`Text Clipped: "${f.text}" is vertically cut off.`);
      }
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        warnings.push(`Text Clipped: "${f.text}" is horizontally cut off.`);
      }
    }
  });

  // 3. Check for Overlapping Elements (in absolute positioning mode only)
  // Check pairs of fields
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      const f1 = fields[i];
      const f2 = fields[j];

      // Only check if both are absolute or have text, excluding images/QR codes which have distinct positions
      if (f1.tag === 'IMG' || f2.tag === 'IMG' || f1.tag === 'CANVAS' || f2.tag === 'CANVAS') continue;
      if (!f1.text || !f2.text) continue;

      // Calculate intersection
      const xOverlap = Math.max(0, Math.min(f1.rect.right, f2.rect.right) - Math.max(f1.rect.left, f2.rect.left));
      const yOverlap = Math.max(0, Math.min(f1.rect.bottom, f2.rect.bottom) - Math.max(f1.rect.top, f2.rect.top));

      // If they overlap significantly in both dimensions (e.g. height overlap > 8px and width overlap > 20px)
      if (xOverlap > 25 && yOverlap > 8) {
        warnings.push(`Overlap Alert: "${f1.text}" overlaps with "${f2.text}".`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Checks if a canvas rendered via html2canvas is completely blank or transparent
 */
export const checkCanvasIntegrity = (canvas) => {
  if (!canvas) return { ok: false, error: 'Canvas is null' };
  
  const width = canvas.width;
  const height = canvas.height;
  if (width === 0 || height === 0) {
    return { ok: false, error: 'Canvas has zero dimensions' };
  }

  const ctx = canvas.getContext('2d');
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    // Sample pixels to verify it contains more than a single background color
    const firstR = data[0];
    const firstG = data[1];
    const firstB = data[2];
    const firstA = data[3];
    
    let isBlank = true;
    for (let i = 4; i < data.length; i += 4) {
      if (data[i] !== firstR || data[i+1] !== firstG || data[i+2] !== firstB || data[i+3] !== firstA) {
        isBlank = false;
        break;
      }
    }
    
    if (isBlank) {
      return { ok: false, error: 'Canvas is completely blank or transparent' };
    }
    
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Failed to inspect canvas: ${e.message}` };
  }
};
