import { api } from './apiClient';
import type { ScenarioName, SimulationStatus } from '@/types/api';

export const simulationService = {
  status: () => api.get<SimulationStatus>('/simulation/status'),
  start: () => api.post<SimulationStatus>('/simulation/start'),
  pause: () => api.post<SimulationStatus>('/simulation/pause'),
  reset: () => api.post<SimulationStatus>('/simulation/reset'),
  runScenario: (name: ScenarioName, transformerId: string) =>
    api.post<SimulationStatus>(`/simulation/scenarios/${name}`, undefined, { transformerId }),
};
