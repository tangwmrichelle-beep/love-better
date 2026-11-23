// Starter missions. The admin can add more from the app.
const PRESET_MISSIONS = [
  { emoji: '💌', title: 'Write an encouragement note', description: 'Send a handwritten note or a heartfelt text to someone who needs it.' },
  { emoji: '☕', title: 'Buy someone a drink', description: 'Treat a friend, colleague or the person behind you in the queue.' },
  { emoji: '🙏', title: 'Pray for someone, then tell them', description: 'Ask how you can pray for them, pray, and follow up.' },
  { emoji: '🧹', title: 'Serve without being asked', description: 'Wash the dishes, clear a table, help someone carry their things.' },
  { emoji: '👂', title: 'Really listen', description: 'Give someone your full attention for 15 minutes, phone away.' },
  { emoji: '🙌', title: 'Thank an unsung hero', description: 'Thank a cleaner, security guard, hawker or bus captain by name.' },
  { emoji: '📞', title: 'Call someone you have not spoken to in a while', description: 'Check in on an old friend or a relative.' },
  { emoji: '🎁', title: 'Give a small surprise gift', description: 'It does not need to cost much, just show you were thinking of them.' },
  { emoji: '🍱', title: 'Share a meal', description: 'Invite someone to eat with you, especially someone who usually eats alone.' },
  { emoji: '✨', title: 'Invite someone to the XMAS service', description: 'Personally invite a friend or family member to join us on 24 or 25 Dec.' },
  { emoji: '💬', title: 'Give a genuine compliment', description: 'Notice something good in someone and tell them.' },
  { emoji: '🤝', title: 'Welcome someone new', description: 'Reach out to a newcomer at church, school or work.' },
];

const VERSES = [
  { text: 'We love because he first loved us.', ref: '1 John 4:19' },
  { text: 'Dear children, let us not love with words or speech but with actions and in truth.', ref: '1 John 3:18' },
  { text: 'A new command I give you: Love one another. As I have loved you, so you must love one another.', ref: 'John 13:34' },
  { text: 'And let us consider how we may spur one another on toward love and good deeds.', ref: 'Hebrews 10:24' },
  { text: 'Do everything in love.', ref: '1 Corinthians 16:14' },
  { text: 'Be devoted to one another in love. Honor one another above yourselves.', ref: 'Romans 12:10' },
  { text: 'Carry each other’s burdens, and in this way you will fulfill the law of Christ.', ref: 'Galatians 6:2' },
  { text: 'For God so loved the world that he gave his one and only Son.', ref: 'John 3:16' },
  { text: 'Above all, love each other deeply, because love covers over a multitude of sins.', ref: '1 Peter 4:8' },
  { text: 'Let all that you do be done in love.', ref: '1 Corinthians 16:14 (ESV)' },
];

module.exports = { PRESET_MISSIONS, VERSES };
