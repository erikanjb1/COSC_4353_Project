'use strict';

const ACTIVE_QUEUE_API_URL = 'http://localhost:3000/api/active-queues';

function getQueueAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };

  
  const token = localStorage.getItem('token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  
  const userId = localStorage.getItem('userId');
  const role = localStorage.getItem('role');

  if (userId) {
    headers['x-user-id'] = userId;
  }

  if (role) {
    headers['x-user-role'] = role;
  }

  return headers;
}

async function queueApiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getQueueAuthHeaders(),
      ...(options.headers || {})
    }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || 'Queue request failed.');
  }

  return result.data;
}

async function getActiveQueues(status = null) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return queueApiRequest(`${ACTIVE_QUEUE_API_URL}${query}`);
}

async function getActiveQueueById(queueId) {
  return queueApiRequest(`${ACTIVE_QUEUE_API_URL}/${queueId}`);
}

async function getOpenQueueForService(serviceId) {
  return queueApiRequest(
    `${ACTIVE_QUEUE_API_URL}/service/${serviceId}/open`
  );
}

async function createActiveQueue(serviceId, status = 'open') {
  return queueApiRequest(ACTIVE_QUEUE_API_URL, {
    method: 'POST',
    body: JSON.stringify({ serviceId, status })
  });
}

async function updateActiveQueueStatus(queueId, status) {
  return queueApiRequest(
    `${ACTIVE_QUEUE_API_URL}/${queueId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }
  );
}

// Makes the functions available to existing frontend scripts.
window.QueueApi = {
  getActiveQueues,
  getActiveQueueById,
  getOpenQueueForService,
  createActiveQueue,
  updateActiveQueueStatus
};