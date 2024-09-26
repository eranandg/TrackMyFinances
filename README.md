# TrackMyFinances

**TrackMyFinances** is an open-source project designed to help users track and manage their financial liabilities, such as credit card payments and balances, using the **Plaid API**, **Google Tasks**, and **Google Secret Manager**. The project automates the creation of tasks for tracking payments, while ensuring the secure storage of access tokens using **Google Cloud** tools.

## How It Works

**TrackMyFinances** connects to your financial accounts via the **Plaid API**, retrieves data such as balances and due dates, and creates corresponding tasks in **Google Tasks**. The project is configured to check for payment activity daily and updates task statuses accordingly. 

## Why This Project?

Managing finances across multiple institutions can be challenging. This tool aims to automate much of that process, ensuring that you stay on top of your payments, avoid late fees, and have a clear view of your financial status at all times.

## Features

- **Secure Token Management**: Access tokens from Plaid are securely stored in **Google Secret Manager**, ensuring sensitive data is protected.
- **Automated Task Creation**: Automatically adds or updates tasks in **Google Tasks** to keep track of payment statuses based on the account's payment activity.
- **Payment Status Tracking**: Monitors the status of payments and marks tasks as complete based on payment behavior.
- **Plaid Integration**: Supports integration with any financial institution connected through **Plaid's API**.

## Getting Started

For complete setup instructions, including how to configure your Google Cloud project, enable APIs, and handle Plaid API tokens, refer to the [Wiki: Full Setup Guide](https://github.com/your-repo/wiki).

## Documentation

- [Wiki: Full Setup Guide](https://github.com/your-repo/wiki)
- [Plaid API Documentation](https://plaid.com/docs/)

## License

TrackMyFinances is licensed under the [MIT License](./LICENSE). You are free to use, modify, and distribute this project, provided that the original license is included in any substantial copies or derivatives of the code. See the [LICENSE](./LICENSE) file for more details.
