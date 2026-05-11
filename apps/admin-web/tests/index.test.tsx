import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders the main page', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { name: /Flasenc 管理后台/i }),
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /登录/i })).toBeInTheDocument();
});
