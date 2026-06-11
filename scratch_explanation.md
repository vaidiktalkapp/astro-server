### User Update

**Objective:** Explain the billing logic and 5-min minimum balance for AI Voice Calls.

**Details:**
1. The 5-min rule (`minBalanceRequired = ratePerMinute * 5`) is already present and active in the system.
2. The reason the call goes beyond the max duration is due to frontend WebSocket disconnects (e.g. phone sleeping) causing the frontend to miss the `timer_ended` signal.
3. Reassure the user that no financial loss occurred because the system forcibly capped the billed amount to the wallet's max capacity (e.g. ₹20).
