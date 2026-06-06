import { StrategyDna, Candle } from '../../types';

export interface EvaluationState {
  learningState: 'ACQUIRING' | 'CONVERGING' | 'STABLE_OPTIMAL' | 'RE-CALIBRATING';
  adaptationLevel: number; // 0 to 100%
  learningCycles: number;
  evolutionPhase: string;
  optimizationTargets: string[];
  evolutionStabilityScore: number; // 0 to 100%
  learningProgress: number[];
}

export function evaluateStrategyCohort(
  strategies: StrategyDna[],
  candles: Candle[]
): EvaluationState {
  if (strategies.length === 0) {
    return {
      learningState: 'ACQUIRING',
      adaptationLevel: 10,
      learningCycles: 1,
      evolutionPhase: 'BOOTSTRAPPING GENESIS-0',
      optimizationTargets: ['RSI oversold boundary', 'EMA fast crossover confirmation'],
      evolutionStabilityScore: 50,
      learningProgress: [30, 35, 40, 38, 45, 42, 50]
    };
  }

  const topStrat = strategies[0];
  const winRate = topStrat.metrics?.win_rate || 50;
  const profitFactor = topStrat.metrics?.profit_factor || 1.0;
  
  // Algorithmic evaluation score based on winRate and profitFactor
  const adaptationLevel = Math.min(100, Math.max(10, Math.floor(winRate * 1.2)));
  const stability = Math.min(99, Math.max(20, Math.floor((1 - (topStrat.metrics?.max_drawdown || 1) / 10) * 100)));

  let learningState: EvaluationState['learningState'] = 'CONVERGING';
  let evolutionPhase = 'HYBRID HEURISTIC OPTIMIZATION';

  if (winRate > 65 && profitFactor > 1.5) {
    learningState = 'STABLE_OPTIMAL';
    evolutionPhase = 'COGNITIVE STEADY AUTO-SCALP';
  } else if (winRate < 45) {
    learningState = 'RE-CALIBRATING';
    evolutionPhase = 'REGIME SHIFT RETRAINING PHASE';
  }

  // Derive dynamic optimization targets based on current weak points
  const targets: string[] = [];
  if (topStrat.params.rsi_period > 14) {
    targets.push('Tighten RSI window to detect faster reversal points');
  } else {
    targets.push('Optimize RSI overbought bands to capture macro extremes');
  }

  if (topStrat.params.ema_fast >= topStrat.params.ema_slow) {
    targets.push('Correct Fast-Slow EMA gap convergence bounds');
  } else {
    targets.push('Stabilize Trend EMA gap filter threshold');
  }

  if ((topStrat.metrics?.max_drawdown || 0) > 2.0) {
    targets.push('Enforce strict ATR-based trailing trailing stop limits');
  }

  // Learning progress charts values
  const learningProgress = [
    35 + Math.floor(Math.sin(1) * 10),
    42 + Math.floor(Math.cos(2) * 8),
    48 + Math.floor(Math.sin(3) * 12),
    55 + Math.floor(Math.cos(4) * 5),
    61 + Math.floor(Math.sin(5) * 15),
    adaptationLevel - 10,
    adaptationLevel
  ];

  return {
    learningState,
    adaptationLevel,
    learningCycles: topStrat.generation * 10 + 12,
    evolutionPhase,
    optimizationTargets: targets,
    evolutionStabilityScore: stability,
    learningProgress: learningProgress.map(x => Math.max(10, Math.min(100, x)))
  };
}
