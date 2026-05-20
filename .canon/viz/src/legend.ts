export interface IStatsCounts {
  cards: number;
  links: number;
}

export const renderStats = (counts: IStatsCounts): void => {
  const root = document.createElement('div');
  root.className = 'stats';
  root.textContent = `${counts.cards} entities · ${counts.links} cross-links`;
  document.body.appendChild(root);
};
