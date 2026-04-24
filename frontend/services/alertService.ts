import api from '@/lib/api';

/**
 * Service to handle all alert and anomaly related API calls.
 */
export const alertService = {
  /**
   * Fetches all active system alerts.
   */
  async getAlerts() {
    const response = await api.get('/alerts');
    return response.data;
  },

  /**
   * Fetches detected energy anomalies.
   */
  async getAnomalies() {
    const response = await api.get('/anomalies');
    return response.data;
  }
};
