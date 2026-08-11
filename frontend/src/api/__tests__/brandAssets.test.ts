import { getLatestBrandAvatar, getLatestVoiceClone } from '../brandAssets';
import { apiClient } from '../client';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  aiApiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('brandAssets API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls latest brand avatar endpoint via /api path', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      status: 200,
      data: { success: true, image_url: '/api/youtube/images/avatars/test.png' },
    });

    const response = await getLatestBrandAvatar();

    expect(apiClient.get).toHaveBeenCalledWith('/api/onboarding/assets/latest-avatar', {
      validateStatus: expect.any(Function),
    });
    expect(response.success).toBe(true);
  });

  it('maps 404 brand avatar response to no-avatar payload', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      status: 404,
      data: { detail: 'Not Found' },
    });

    const response = await getLatestBrandAvatar();

    expect(response).toEqual({ success: false, message: 'No avatar found' });
  });

  it('calls latest voice clone endpoint via /api path', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      status: 200,
      data: { success: true, custom_voice_id: 'vc_123' },
    });

    const response = await getLatestVoiceClone();

    expect(apiClient.get).toHaveBeenCalledWith('/api/onboarding/assets/latest-voice-clone');
    expect(response.success).toBe(true);
  });
});

