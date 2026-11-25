// The jar shop. Points come from posting; spend them on jar looks. Admins can change prices in the app.
// Points per post, by who was loved.
const POINTS = { stranger: 3, friend: 2, family: 2, cg: 1 };

// area: jar = jar shape & skin, tag = tag on the bottle neck, bg = background behind the jar.
const ITEMS = [
  { id: 'jar-mason', area: 'jar', name: 'Mason jar', price: 0 },
  { id: 'jar-peanut', area: 'jar', name: 'Peanut butter jar', price: 5 },
  { id: 'jar-jam', area: 'jar', name: 'Jam jar', price: 5 },
  { id: 'jar-polka', area: 'jar', name: 'Polka dot jar', price: 8 },
  { id: 'jar-choc', area: 'jar', name: 'Choc spread jar', price: 10 },
  { id: 'tag-none', area: 'tag', name: 'No tag', price: 0 },
  { id: 'tag-letter', area: 'tag', name: 'Love letter', price: 2 },
  { id: 'tag-plane', area: 'tag', name: 'Paper airplane', price: 2 },
  { id: 'tag-bear', area: 'tag', name: 'Bear', price: 4 },
  { id: 'tag-dog', area: 'tag', name: 'Dog', price: 4 },
  { id: 'bg-plain', area: 'bg', name: 'Plain colour', price: 0 },
  { id: 'bg-dots', area: 'bg', name: 'Polka dots', price: 3 },
  { id: 'bg-stripes', area: 'bg', name: 'Stripes', price: 3 },
  { id: 'bg-hearts', area: 'bg', name: 'Little hearts', price: 5 },
  { id: 'bg-gingham', area: 'bg', name: 'Gingham', price: 5 },
  { id: 'bg-stars', area: 'bg', name: 'Stars', price: 5 },
];
// Background colours are always free.
const COLOURS = ['#FFFFFF', '#E3F4F1', '#E4F0FB', '#FDE7EF', '#EEE6FB', '#FFF4D6', '#F3EBDD'];
const DEFAULT_STYLE = { jar: 'jar-mason', tag: 'tag-none', bg: 'bg-plain', color: '#FFFFFF' };

module.exports = { POINTS, ITEMS, COLOURS, DEFAULT_STYLE };
