import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { Sidebar } from './Sidebar';

vi.mock('../../context/ApiContext.tsx', () => ({
  useApi: () => ({
    health: { status: 'success' },
    version: { data: { version: 'test' } },
    isProbing: false,
    refreshProbes: vi.fn(),
  }),
}));

// WHY: MemoryRouter provides route context without starting API calls or browser navigation.
function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  it('links to the deployments list without a hard-coded deployment detail ID', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: /Deployments/ })).toHaveAttribute('href', '/deployments');
    expect(
      screen.queryAllByRole('link').some(link => /^\/deployments\/dep-/i.test(link.getAttribute('href') ?? '')),
    ).toBe(false);
  });
});
