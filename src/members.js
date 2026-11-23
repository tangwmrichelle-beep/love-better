// CG member list from Richelle. If someone's first name matches, their avatar is locked to this gender.
// Matching ignores capital letters, spaces and dashes ("jing xun" = "JingXun").
const FEMALE = ['Richelle', 'Adel', 'Clarissa', 'Jing Xun', 'Joanne', 'Hailey', 'Jolie', 'Eze', 'Isabel', 'Metha', 'Wendee', 'Jerlyn', 'Heidi', 'Fiona'];
const MALE = ['Jordan', 'Chu Yu', 'Tran', 'Jeremy', 'James', 'Terry', 'Brad', 'Cayus', 'Jasper', 'Zhen Yong', 'Ben', 'Jared', 'Abel', 'Casey', 'Darren'];

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ROSTER = new Map([...FEMALE.map(n => [norm(n), 'girl']), ...MALE.map(n => [norm(n), 'boy'])]);
const SPELLING = new Map([...FEMALE, ...MALE].map(n => [norm(n), n]));

// Returns 'boy' / 'girl' if the first name is on the list, otherwise null.
function genderForName(firstName) { return ROSTER.get(norm(firstName)) || null; }

// Tidy spelling: the list's spelling if listed, otherwise capitalise each word ("jing xun" -> "Jing Xun").
function tidyName(firstName) {
  return SPELLING.get(norm(firstName)) || String(firstName).replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
}

module.exports = { genderForName, tidyName, FEMALE, MALE };
