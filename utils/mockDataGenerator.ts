
import { DailyStats, AppUsageData, AppCategory, Badge, Streak, Challenge } from '@/types/appUsage';

const mockApps: Array<{ name: string; category: AppCategory }> = [
  { name: 'Notion', category: 'productivity' },
  { name: 'Google Docs', category: 'productivity' },
  { name: 'Slack', category: 'productivity' },
  { name: 'Instagram', category: 'social' },
  { name: 'Twitter', category: 'social' },
  { name: 'WhatsApp', category: 'social' },
  { name: 'YouTube', category: 'entertainment' },
  { name: 'Netflix', category: 'entertainment' },
  { name: 'Spotify', category: 'entertainment' },
  { name: 'Settings', category: 'other' },
  { name: 'Camera', category: 'other' },
];

export function generateMockData(): DailyStats {
  const today = new Date().toISOString().split('T')[0];
  
  const apps: AppUsageData[] = mockApps.map(app => ({
    appName: app.name,
    category: app.category,
    usageTime: Math.floor(Math.random() * 120) + 5, // 5-125 minutes
    openCount: Math.floor(Math.random() * 30) + 1,
    lastUsed: new Date(Date.now() - Math.random() * 3600000), // within last hour
  }));

  const productivityTime = apps
    .filter(a => a.category === 'productivity')
    .reduce((sum, a) => sum + a.usageTime, 0);
  
  const socialTime = apps
    .filter(a => a.category === 'social')
    .reduce((sum, a) => sum + a.usageTime, 0);
  
  const entertainmentTime = apps
    .filter(a => a.category === 'entertainment')
    .reduce((sum, a) => sum + a.usageTime, 0);
  
  const otherTime = apps
    .filter(a => a.category === 'other')
    .reduce((sum, a) => sum + a.usageTime, 0);

  const totalScreenTime = productivityTime + socialTime + entertainmentTime + otherTime;
  const appSwitches = apps.reduce((sum, a) => sum + a.openCount, 0);
  
  // Calculate focus time (productivity time with low switching)
  const focusTime = Math.floor(productivityTime * 0.7);
  
  // Calculate focus score (0-100)
  const focusScore = Math.min(100, Math.floor(
    (focusTime / 120) * 50 + // 50 points for focus time
    (Math.max(0, 50 - appSwitches) / 50) * 50 // 50 points for low switching
  ));

  return {
    date: today,
    totalScreenTime,
    appSwitches,
    productivityTime,
    socialTime,
    entertainmentTime,
    otherTime,
    focusTime,
    focusScore,
    focusScoreReason: 'Sample explanation for mock data.',
    apps: apps.sort((a, b) => b.usageTime - a.usageTime),
  };
}

export function generateWeeklyMockData() {
  const weekData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    weekData.push({
      date: dateStr,
      screenTime: Math.floor(Math.random() * 300) + 100, // 100-400 minutes
      appSwitches: Math.floor(Math.random() * 80) + 20, // 20-100 switches
    });
  }
  return weekData;
}

export function generateMockBadges(): Badge[] {
  return [
    {
      id: 'focus_master',
      name: 'Focus Master',
      description: 'Complete 2 hours of focused work',
      icon: 'brain.head.profile',
      earnedAt: new Date(),
      progress: 100,
      requirement: '2 hours of focus time',
    },
    {
      id: 'low_switcher',
      name: 'Steady Focus',
      description: 'Keep app switches under 10 in an hour',
      icon: 'target',
      earnedAt: null,
      progress: 65,
      requirement: 'Less than 10 switches per hour',
    },
    {
      id: 'balanced_day',
      name: 'Balanced Day',
      description: 'Maintain healthy balance between work and entertainment',
      icon: 'scale.3d',
      earnedAt: null,
      progress: 80,
      requirement: 'Balanced app usage',
    },
    {
      id: 'early_bird',
      name: 'Early Bird',
      description: 'Start your day with productivity',
      icon: 'sunrise.fill',
      earnedAt: new Date(),
      progress: 100,
      requirement: 'Productive morning session',
    },
    {
      id: 'calm_streak',
      name: 'Calm Streak',
      description: 'Maintain low stimulation for 3 days',
      icon: 'leaf.fill',
      earnedAt: null,
      progress: 33,
      requirement: '3 days of calm usage',
    },
  ];
}

export function generateMockStreaks(): Streak[] {
  return [
    {
      type: 'focus',
      currentStreak: 3,
      longestStreak: 7,
      lastUpdated: new Date(),
    },
    {
      type: 'low_switching',
      currentStreak: 2,
      longestStreak: 5,
      lastUpdated: new Date(),
    },
    {
      type: 'balanced_usage',
      currentStreak: 1,
      longestStreak: 4,
      lastUpdated: new Date(),
    },
  ];
}

export function generateMockChallenges(): Challenge[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return [
    {
      id: 'daily_focus',
      title: 'Daily Focus Challenge',
      description: 'Keep app switches under 10 this hour',
      target: 10,
      current: 7,
      type: 'app_switches',
      expiresAt: new Date(Date.now() + 3600000),
      completed: false,
      reward: 'Focus Badge',
    },
    {
      id: 'focus_time',
      title: 'Focus Time Goal',
      description: 'Achieve 30 minutes of focused work',
      target: 30,
      current: 18,
      type: 'focus_time',
      expiresAt: tomorrow,
      completed: false,
      reward: 'Productivity Star',
    },
    {
      id: 'entertainment_limit',
      title: 'Entertainment Balance',
      description: 'Keep entertainment under 60 minutes today',
      target: 60,
      current: 45,
      type: 'entertainment_limit',
      expiresAt: tomorrow,
      completed: false,
      reward: 'Balance Master',
    },
  ];
}
