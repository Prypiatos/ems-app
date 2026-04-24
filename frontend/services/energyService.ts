import api from '@/lib/api';

/**
 * Service to handle all energy and prediction related API calls.
 */
export const energyService = {
  /**
   * Fetches aggregate energy consumption data.
   */
  async getAggregateData() {
    const response = await api.get('/energy/aggregate');
    return response.data;
  },

  /**
   * Fetches energy usage predictions/forecasts.
   */
  async getPredictions() {
    const response = await api.get('/prediction');
    return response.data;
  }
};
