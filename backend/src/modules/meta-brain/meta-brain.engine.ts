import { Injectable } from '@nestjs/common';

export interface ChildFeatures {
  childId: string;
  name: string;
  attendanceRate: number;
  attendanceTrend: number;
  lastVisitDays: number;
  paymentStatus: 'PAID' | 'PENDING' | 'OVERDUE' | null;
  paymentDelayDays: number;
  progressRate: number;
  absenceStreak: number;
  disciplineScore: number;
  belt: string;
  groupId?: string;
  subscriptionPrice?: number;
}

export interface RiskWeights {
  attendance: number;
  inactivity: number;
  payment: number;
  streak: number;
}

export interface RiskResult {
  childId: string;
  name: string;
  risk: number;
  status: 'good' | 'warning' | 'critical';
  churnProbability: number;
  revenueAtRisk: number;
  signals: string[];
  actions: Array<{ type: string; priority: 'low' | 'medium' | 'high' | 'critical'; text?: string }>;
  features: ChildFeatures;
}

@Injectable()
export class MetaBrainEngine {
  // Оптимізовані ваги згідно специфікації
  private weights: RiskWeights = {
    attendance: 40,
    inactivity: 25,
    payment: 25,
    streak: 10,
  };

  // Середня ціна підписки (для revenue at risk)
  private avgSubscriptionPrice = 2500;

  calculateRisk(features: ChildFeatures): RiskResult {
    let score = 0;
    const signals: string[] = [];

    // Attendance risk (0-40 points) - вага 40%
    if (features.attendanceRate < 40) {
      score += 40;
      signals.push('CRITICAL_ATTENDANCE');
    } else if (features.attendanceRate < 60) {
      score += 25;
      signals.push('LOW_ATTENDANCE');
    } else if (features.attendanceRate < 75) {
      score += 15;
      signals.push('MODERATE_ATTENDANCE');
    } else if (features.attendanceRate < 85) {
      score += 5;
    }

    // Inactivity risk (0-25 points) - вага 25%
    if (features.lastVisitDays > 14) {
      score += 25;
      signals.push('INACTIVE_14_DAYS');
    } else if (features.lastVisitDays > 7) {
      score += 15;
      signals.push('INACTIVE_7_DAYS');
    } else if (features.lastVisitDays > 3) {
      score += 5;
      signals.push('INACTIVE_3_DAYS');
    }

    // Payment risk (0-25 points) - вага 25%
    if (features.paymentStatus === 'OVERDUE' && features.paymentDelayDays > 7) {
      score += 25;
      signals.push('PAYMENT_OVERDUE_CRITICAL');
    } else if (features.paymentStatus === 'OVERDUE') {
      score += 18;
      signals.push('PAYMENT_OVERDUE');
    } else if (features.paymentDelayDays > 3) {
      score += 10;
      signals.push('PAYMENT_DELAYED');
    } else if (features.paymentStatus === 'PENDING') {
      score += 3;
      signals.push('PAYMENT_PENDING');
    }

    // Absence streak risk (0-10 points) - вага 10%
    if (features.absenceStreak >= 3) {
      score += 10;
      signals.push('ABSENCE_STREAK_CRITICAL');
    } else if (features.absenceStreak >= 2) {
      score += 6;
      signals.push('ABSENCE_STREAK');
    }

    // Determine status
    let status: 'good' | 'warning' | 'critical' = 'good';
    if (score >= 70) status = 'critical';
    else if (score >= 40) status = 'warning';

    // Calculate churn probability
    const churnProbability = this.calculateChurnProbability(score);

    // Calculate revenue at risk
    const revenueAtRisk = this.calculateRevenueAtRisk(
      status, 
      churnProbability,
      features.subscriptionPrice || this.avgSubscriptionPrice
    );

    // Generate actions
    const actions = this.generateActions(features, score, signals);

    return {
      childId: features.childId,
      name: features.name,
      risk: Math.min(score, 100),
      status,
      churnProbability,
      revenueAtRisk,
      signals,
      actions,
      features,
    };
  }

  /**
   * Розрахунок ймовірності відтоку
   */
  private calculateChurnProbability(score: number): number {
    if (score < 40) return 0.1;  // Низький ризик: 10%
    if (score < 60) return 0.3;  // Помірний: 30%
    if (score < 70) return 0.5;  // Підвищений: 50%
    return 0.8;                   // Критичний: 80%
  }

  /**
   * Розрахунок revenue at risk
   */
  private calculateRevenueAtRisk(
    status: 'good' | 'warning' | 'critical',
    churnProbability: number,
    subscriptionPrice: number
  ): number {
    if (status === 'critical') {
      return Math.round(subscriptionPrice * churnProbability);
    }
    if (status === 'warning') {
      return Math.round(subscriptionPrice * churnProbability * 0.5);
    }
    return 0;
  }

  private generateActions(
    features: ChildFeatures,
    score: number,
    signals: string[],
  ): Array<{ type: string; priority: 'low' | 'medium' | 'high' | 'critical'; text?: string }> {
    const actions: Array<{ type: string; priority: 'low' | 'medium' | 'high' | 'critical'; text?: string }> = [];

    // Critical risk - immediate call
    if (score >= 70) {
      actions.push({
        type: 'CALL_PARENT',
        priority: 'critical',
        text: 'Терміново зателефонувати батькам',
      });
    }

    // Absence streak
    if (signals.includes('ABSENCE_STREAK') || signals.includes('ABSENCE_STREAK_CRITICAL')) {
      actions.push({
        type: 'SEND_MESSAGE',
        priority: signals.includes('ABSENCE_STREAK_CRITICAL') ? 'high' : 'medium',
        text: 'Запросити на наступне тренування',
      });
    }

    // Payment issues
    if (signals.includes('PAYMENT_OVERDUE')) {
      actions.push({
        type: 'PAYMENT_REMINDER',
        priority: 'high',
        text: 'Нагадати про оплату',
      });
    }

    // Inactivity
    if (signals.includes('INACTIVE_7_DAYS') || signals.includes('INACTIVE_14_DAYS')) {
      actions.push({
        type: 'CHECK_IN',
        priority: signals.includes('INACTIVE_14_DAYS') ? 'high' : 'medium',
        text: 'Перевірити стан учня',
      });
    }

    // Progress opportunity - upsell
    if (features.progressRate > 80 && features.attendanceRate > 75) {
      actions.push({
        type: 'UPSELL_PERSONAL',
        priority: 'low',
        text: 'Рекомендувати персональні тренування',
      });
    }

    // Belt promotion ready
    if (features.progressRate > 85 && features.attendanceRate > 80 && features.disciplineScore > 85) {
      actions.push({
        type: 'BELT_PROMOTION',
        priority: 'medium',
        text: 'Готовий до наступного поясу',
      });
    }

    return actions;
  }

  // Calculate priority score for action queue
  calculatePriorityScore(
    risk: number,
    urgency: number,
    revenueImpact: number,
  ): number {
    return Math.round(
      risk * 0.6 +
      urgency * 0.3 +
      revenueImpact * 0.1
    );
  }

  // Adapt weights based on outcome (machine learning)
  adaptWeights(outcome: 'churned' | 'retained' | 'improved') {
    if (outcome === 'churned') {
      this.weights.attendance += 2;
      this.weights.inactivity += 2;
      this.normalizeWeights();
    } else if (outcome === 'retained') {
      this.weights.streak += 1;
      this.normalizeWeights();
    }
    return this.weights;
  }

  private normalizeWeights() {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(this.weights) as (keyof RiskWeights)[]) {
      this.weights[key] = Math.round((this.weights[key] / sum) * 100);
    }
  }

  getWeights(): RiskWeights {
    return { ...this.weights };
  }
}
