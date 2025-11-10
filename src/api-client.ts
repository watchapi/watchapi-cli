import axios, { AxiosInstance } from "axios";
import type { Collection, Report } from "./types.js";

export class ApiClient {
  private client: AxiosInstance;

  constructor(apiUrl: string, apiToken: string) {
    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });
  }

  async getCollection(collectionId: string): Promise<Collection> {
    const response = await this.client.get(`/api/cli/collections/${collectionId}`);
    return response.data;
  }

  async submitReport(report: Report): Promise<{ success: boolean; regressions: string[] }> {
    const response = await this.client.post("/api/cli/report", report);
    return response.data;
  }
}
