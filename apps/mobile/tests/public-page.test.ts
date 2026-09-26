import { describe, expect, it } from '@jest/globals';

import { renderPublicPage } from '@/public-page/render';

const opts = { apiUrl: 'https://api.ganador.nexoru.ai' };
const active = {
  status: 'active' as const,
  pet: { name: 'Firulais', species: 'dog' as const, photoUrl: '/public/photos/p/x.webp' },
  owner: { name: 'Ana', whatsappUrl: 'https://wa.me/525512345678?text=Hola' },
  health: { conditions: 'Epilepsia' },
};

describe('página pública de la placa', () => {
  it('muestra foto, nombre, datos autorizados y un solo botón de WhatsApp', () => {
    const html = renderPublicPage(active, opts);
    expect(html).toContain('<h1>Firulais</h1>');
    expect(html).toContain('src="https://api.ganador.nexoru.ai/public/photos/p/x.webp"');
    expect(html).toContain('Su familia: Ana');
    expect(html).toContain('Enfermedades: Epilepsia');
    expect(html.match(/class="wa"/g)).toHaveLength(1);
    expect(html).toContain('href="https://wa.me/525512345678?text=Hola"');
  });

  it('no ofrece llamada ni muestra el número como texto (FR-023)', () => {
    const html = renderPublicPage(active, opts);
    expect(html).not.toContain('tel:');
    const visible = html.replace(/<[^>]+>/g, ' ');
    expect(visible).not.toContain('5512345678');
  });

  it('no carga JavaScript', () => {
    expect(renderPublicPage(active, opts)).not.toMatch(/<script/i);
  });

  it('escapa el contenido', () => {
    const html = renderPublicPage({ ...active, pet: { ...active.pet, name: '<b>x</b>' } }, opts);
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
  });

  it('placa inactiva o inexistente', () => {
    expect(renderPublicPage({ status: 'inactive' }, opts)).toContain('Placa no activa');
    expect(renderPublicPage(null, opts)).toContain('Placa no activa');
  });

  it('está en español de México', () => {
    expect(renderPublicPage(active, opts)).toContain('lang="es-MX"');
  });
});
