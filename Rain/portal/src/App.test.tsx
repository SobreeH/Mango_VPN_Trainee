import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('Portal App shell', () => {
  it('renders the MANGO VPN v2 Zero-Trust portal shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /MANGO VPN/i })).toBeInTheDocument();
    expect(screen.getByText(/Zero-Trust WireGuard Portal/i)).toBeInTheDocument();
  });
});
