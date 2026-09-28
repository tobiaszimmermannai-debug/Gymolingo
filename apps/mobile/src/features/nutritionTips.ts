import { nutritionTips as coreTips, type AthleteProfile, type MealEntry } from '@gymolingo/core';

export function nutritionTips(profile: AthleteProfile, meals: MealEntry[], date: string) {
  return coreTips(profile, meals, date, new Date().getHours());
}
