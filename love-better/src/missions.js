// Three ways to love (from the "To love is to hear / see / delight" sermon). Every mission belongs to one of them.
const MISSION_CATEGORIES = [
  { key: 'hear', title: 'To love is to hear', emoji: '👂', heart: 'What you say matters to me',
    about: 'Be patient with someone’s perspective. Listen to understand, not just to reply.',
    example: 'I intentionally listened to a friend today' },
  { key: 'see', title: 'To love is to see', emoji: '👀', heart: 'What matters to you matters to me',
    about: 'Notice the obvious, and notice the unspoken struggles and joys.',
    example: 'I observed something unspoken today and did something about it' },
  { key: 'delight', title: 'To love is to delight', emoji: '🎁', heart: 'Your presence matters to me',
    about: 'Let people know we truly enjoy their company and that they are important to us.',
    example: 'I gifted a letter of appreciation to a friend today after hanging out' },
];

// Starter missions. The admin can add more from the app.
const PRESET_MISSIONS = [
  { category: 'hear', emoji: '👂', title: 'Intentionally listen to a friend', description: 'Ask how they are really doing, put your phone away and listen to understand, not just to reply.' },
  { category: 'see', emoji: '👀', title: 'Notice something unspoken and act on it', description: 'Someone looks tired, left out or quietly happy about something? Notice it and do something about it.' },
  { category: 'delight', emoji: '💌', title: 'Gift a letter of appreciation', description: 'After hanging out, write a friend a note about what you appreciate in them.' },
];

// Every other starter mission we have ever shipped. They are switched off; the admin adds new ones from the app.
const RETIRED_MISSIONS = ['Really listen', 'Write an encouragement note', 'Give a small surprise gift', 'Listen to understand, not to reply',
  'Be patient with someone’s perspective', 'Pray for someone, then tell them', 'Call someone you have not spoken to in a while', 'Notice the obvious',
  'Remember what matters to them', 'Serve without being asked', 'Thank an unsung hero', 'Welcome someone new', 'Celebrate someone’s joy', 'Just be there',
  'Share a meal', 'Buy someone a drink', 'Give a genuine compliment', 'Invite someone to the XMAS service'];

// Verse of the day rotation. One translation per verse, labelled.
const VERSES = [
  { text: 'We love because he first loved us.', ref: '1 John 4:19 (NIV)' },
  { text: 'I love the Lord because he hears my voice and my prayer for mercy. Because he bends down to listen, I will pray as long as I have breath!', ref: 'Psalm 116:1-2 (NLT)' },
  { text: 'Dear children, let us not love with words or speech but with actions and in truth.', ref: '1 John 3:18 (NIV)' },
  { text: 'Then she called the name of the Lord who spoke to her, You-Are-the-God-Who-Sees; for she said, “Have I also here seen Him who sees me?”', ref: 'Genesis 16:13 (NKJV)' },
  { text: 'A new command I give you: Love one another. As I have loved you, so you must love one another.', ref: 'John 13:34 (NIV)' },
  { text: 'And let us consider how we may spur one another on toward love and good deeds.', ref: 'Hebrews 10:24 (NIV)' },
  { text: 'Do everything in love.', ref: '1 Corinthians 16:14 (NIV)' },
  { text: 'Be devoted to one another in love. Honor one another above yourselves.', ref: 'Romans 12:10 (NIV)' },
  { text: 'Carry each other’s burdens, and in this way you will fulfill the law of Christ.', ref: 'Galatians 6:2 (NIV)' },
  { text: 'For God so loved the world that he gave his one and only Son.', ref: 'John 3:16 (NIV)' },
  { text: 'Above all, love each other deeply, because love covers over a multitude of sins.', ref: '1 Peter 4:8 (NIV)' },
];

module.exports = { PRESET_MISSIONS, MISSION_CATEGORIES, RETIRED_MISSIONS, VERSES };
