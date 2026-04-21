import api from '@/lib/api';

/**
 * Service to handle all device/node related API calls.
 */
export const nodeService = {
  /**
   * Fetches all energy monitoring nodes from the gateway.
   */
  async getAllNodes() {
    const response = await api.get('/nodes');
    return response.data;
  },

  /**
   * Fetches specific health status for a single node.
   */
  async getNodeHealth(id: string) {
    const response = await api.get(`/health/${id}`);
    return response.data;
  },

  /**
   * Fetches full details for a specific node by ID.
   */
  async getNodeDetails(id: string) {
    const response = await api.get(`/nodes/${id}`);
    return response.data;
  }
};
