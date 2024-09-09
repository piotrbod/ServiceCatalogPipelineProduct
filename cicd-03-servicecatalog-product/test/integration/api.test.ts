import axios from 'axios';
import { expect } from 'chai';

const API_URL = process.env.API_URL as string;
const EMPLOYER_ID = process.env.EMPLOYER_ID as string;

// Define the context type for Mocha tests
interface TestContext {
  timeout(ms: number): void;
}

describe('API Integration Tests', function(this: TestContext) {
  this.timeout(5000); // Set timeout for the test

  it('should return a list of employees', async function(this: TestContext) {
    if (!EMPLOYER_ID) {
      throw new Error('Employer ID is not provided');
    }

    const response = await axios.get(`${API_URL}/get_employees`, {
      params: { employer_id: EMPLOYER_ID },
    });

    // Check if the list of employees is empty
    expect(response.data.length).to.be.greaterThan(0, 'The list of employees is empty');
  });
});
