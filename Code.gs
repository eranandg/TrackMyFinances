// Google API credentials
var GOOGLE_CLIENT_ID = getScriptProperty('google_client_id');
var GOOGLE_CLIENT_SECRET = getScriptProperty('google_client_secret');

// Plaid API credentials
const PLAID_CLIENT_ID = getScriptProperty('plaid_client_id');
const PLAID_SECRET = getScriptProperty('plaid_secret');
const PLAID_ENV = 'production';
const PLAID_API_BASE_URL = `https://${PLAID_ENV}.plaid.com`;

// Get script property
function getScriptProperty(propertyName) {
  return PropertiesService.getScriptProperties().getProperty(propertyName);
}

// Function to configure OAuth2 service
function getOAuthService() {
  return OAuth2.createService('GoogleSecretManager')
    .setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setClientId(GOOGLE_CLIENT_ID)
    .setClientSecret(GOOGLE_CLIENT_SECRET)
    .setScope('https://www.googleapis.com/auth/cloud-platform')
    .setCallbackFunction('authCallback')
    .setPropertyStore(PropertiesService.getUserProperties());
}

// Helper function to get OAuth2 token
function getOAuthToken() {
  const service = getOAuthService();
  
  if (!service.hasAccess()) {
    const authorizationUrl = service.getAuthorizationUrl();
    throw new Error('OAuth2 Authorization required. Visit the URL in the log to authorize the script: ' + authorizationUrl);
  }
  
  return service.getAccessToken();
}

// Function to get access token from Google Secret Manager
function getAccessTokenFromSecretManager(institution) {
  const secretName = `projects/{YOUR-PROJECT-ID}/secrets/${institution}/versions/latest`;
  const token = getOAuthToken();

  const url = `https://secretmanager.googleapis.com/v1/${secretName}:access`;
  const options = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    throw new Error(`Failed to fetch secret: ${data.error.message}`);
  }

  return data.payload.data ? Utilities.newBlob(Utilities.base64Decode(data.payload.data)).getDataAsString() : '';
}

// OAuth2 authorization callback
function authCallback(request) {
  const service = getOAuthService();
  const isAuthorized = service.handleCallback(request);

  if (isAuthorized) {
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    return HtmlService.createHtmlOutput('Authorization denied. Please try again.');
  }
}

// Function to create a link token
function createLinkToken() {
  const url = `${PLAID_API_BASE_URL}/link/token/create`;
  const payload = {
    client_id: PLAID_CLIENT_ID,
    secret: PLAID_SECRET,
    user: {
      client_user_id: 'your-user-id'
    },
    client_name: 'TrackMyFinances',
    products: ['liabilities'],
    country_codes: ['US'],
    language: 'en'
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  Logger.log('Link Token: ' + data.link_token);
}

// Function to exchange public token for access token
function exchangePublicTokenForAccessToken(publicToken) {
  const url = `${PLAID_API_BASE_URL}/item/public_token/exchange`;
  const payload = {
    client_id: PLAID_CLIENT_ID,
    secret: PLAID_SECRET,
    public_token: publicToken
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  Logger.log('Access Token: ' + data.accessToken);
}

// Main function to get credit card details
function getLiabilities() {
  const institutions = ['discover', 'bofa', 'capitalone'];

  institutions.forEach(institution => {
    const accessToken = getAccessTokenFromSecretManager(institution);
    
    const url = `${PLAID_API_BASE_URL}/liabilities/get`;
    const payload = {
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      access_token: accessToken,
    };

    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());

    if (data.liabilities && data.liabilities.credit) {
      processLiabilities(data);
    }
  });
}

// Main function to handle credit card tasks
function processLiabilities(data) {
  const accountName = data.accounts[0].name || "Unknown Card"; 
  const liability = data.liabilities.credit[0];

  const nextPaymentDueDate = liability.next_payment_due_date;
  const lastPaymentAmount = liability.last_payment_amount;
  const lastPaymentDate = new Date(liability.last_payment_date);
  const lastStatementBalance = liability.last_statement_balance;
  const lastStatementIssueDate = new Date(liability.last_statement_issue_date);
  const minimumPaymentAmount = liability.minimum_payment_amount;
  const isOverdue = liability.is_overdue;

  const isPaymentComplete = lastPaymentDate > lastStatementIssueDate && lastPaymentAmount >= lastStatementBalance;

  let taskTitle = accountName + " Payment Due";
  let taskNotes = `
    Last Payment Amount: ${lastPaymentAmount}
    Last Payment Date: ${liability.last_payment_date}
    Last Statement Balance: ${lastStatementBalance}
    Last Statement Issue Date: ${liability.last_statement_issue_date}
    Minimum Payment Amount: ${minimumPaymentAmount}
    Next Payment Due Date: ${nextPaymentDueDate}
    Status: ${isPaymentComplete ? 'Complete' : 'Open/In Progress'}
  `;

  const taskList = getTaskListByName('Liabilities');
  const existingTask = findTaskByTitle(taskList, taskTitle);
  
  if (existingTask) {
    updateTask(existingTask, taskList.id, taskNotes, isPaymentComplete);
  } else {
    createNewTask(taskList, taskTitle, taskNotes, nextPaymentDueDate, isPaymentComplete);
  }

  if (isOverdue) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    const overdueTaskTitle = accountName + " (Overdue Payment)";
    const overdueTaskNotes = "This payment is overdue! Please settle it immediately.";

    const existingOverdueTask = findTaskByTitle(taskList, overdueTaskTitle);
    if (!existingOverdueTask) {
      createNewTask(taskList, overdueTaskTitle, overdueTaskNotes, today, false);
    }
  }
}

// Utility to find and return the existing "Liabilities" task list
function getTaskListByName(listName) {
  const taskLists = Tasks.Tasklists.list().getItems();
  let taskList = taskLists.find(list => list.title === listName);

  if (!taskList) {
    throw new Error('Task list "' + listName + '" not found.');
  }

  return taskList;
}

// Utility to find an existing task by title only
function findTaskByTitle(taskList, taskTitle) {
  const tasks = Tasks.Tasks.list(taskList.id).items;
  return tasks.find(task => task.title === taskTitle) || null; 
}

// Utility to create a new task
function createNewTask(taskList, title, notes, dueDate, isComplete) {
  const task = {
    title: title,
    notes: notes,
    due: new Date(dueDate).toISOString(),
    status: isComplete ? 'completed' : 'needsAction'
  };
  Tasks.Tasks.insert(task, taskList.id);
}

// Utility to update an existing task
function updateTask(task, taskListId, notes, isComplete) {
  if (!task || !task.id || !taskListId) {
    throw new Error('Cannot update task: missing task or task list ID');
  }

  task.notes = notes;
  task.status = isComplete ? 'completed' : 'needsAction';
  Tasks.Tasks.update(task, taskListId, task.id);
}
