# Source association browser evidence

The native `SourceAssociationPanel` is implemented on Lead Detail using the existing SourceContinuity endpoints. It exposes Admin-only Link, Unlink and Reject controls, current version and UNVERIFIED audit state.

The focused browser acceptance was attempted but did not yet produce a stable PASS: the first Link command did not render the expected status feedback. PostgreSQL and HTTP source-link contracts remain covered; UI association acceptance is therefore retained as a blocker.
