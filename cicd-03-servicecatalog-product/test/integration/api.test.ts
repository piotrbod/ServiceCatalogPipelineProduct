import axios from 'axios';

const API_URL = process.env.API_URL as string;
const EMPLOYER_ID = process.env.EMPLOYER_ID as string;

console.log(`API URL: ${API_URL}`);
console.log(`Employer ID: ${EMPLOYER_ID}`);

describe('API Integration Tests', () => {
  it('should return a list of employees', async () => {
    if (!EMPLOYER_ID) {
      throw new Error('Employer ID is not provided');
    }

    const response = await axios.get(`${API_URL}/employees`, {
      params: { employerId: EMPLOYER_ID },
    });

    // Check if the list of employees is empty
    expect(response.data.length).toBeGreaterThan(0);
  });
});
