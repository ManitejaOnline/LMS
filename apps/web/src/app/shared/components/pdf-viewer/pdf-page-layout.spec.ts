describe('pdf page watermark layout', () => {
  function mount(pageCss: string) {
    const viewport = document.createElement('div');
    viewport.style.cssText =
      'display:flex;justify-content:center;align-items:flex-start;padding:8px;';
    const page = document.createElement('div');
    page.className = 'pdf-page';
    page.style.cssText = pageCss;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 500;
    canvas.style.width = '400px';
    canvas.style.height = '500px';
    const watermark = document.createElement('div');
    watermark.className = 'pdf-watermark';
    watermark.textContent = 'Zebl India LMS';
    watermark.style.cssText =
      'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-20deg);pointer-events:none;';
    page.appendChild(canvas);
    page.appendChild(watermark);
    viewport.appendChild(page);
    document.body.appendChild(viewport);
    const pageRect = page.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    document.body.removeChild(viewport);
    return { pageRect, canvasRect, watermarkCount: page.querySelectorAll('.pdf-watermark').length };
  }

  it('container-type + overflow hidden collapses the page (the regression)', () => {
    const { pageRect } = mount(
      'position:relative;display:inline-block;overflow:hidden;container-type:inline-size',
    );
    expect(pageRect.width).toBe(0);
  });

  it('positioning-only wrapper keeps the canvas at PDF.js CSS size', () => {
    const { pageRect, canvasRect, watermarkCount } = mount('position:relative');
    expect(canvasRect.width).toBe(400);
    expect(canvasRect.height).toBe(500);
    expect(pageRect.width).toBe(400);
    expect(pageRect.height).toBe(500);
    expect(watermarkCount).toBe(1);
  });
});
