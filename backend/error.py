def get_user_friendly_error(stage: str, error: Exception) -> str:
    """
    Convert technical provider errors into safe
    messages for the frontend.
    """

    message = str(error).lower()

    if stage == "gemini":

        if (
            "429" in message
            or "resource_exhausted" in message
            or "quota" in message
        ):
            return (
                "The AI summary is temporarily unavailable. "
                "Your transcript is safe and the summary will be retried later."
            )

        if (
            "503" in message
            or "unavailable" in message
            or "high demand" in message
        ):
            return (
                "The AI summary service is temporarily unavailable. "
                "Your transcript is safe and the summary will be retried later."
            )

        return (
            "We couldn't generate the AI summary. "
            "Your transcript is safe."
        )

    if stage == "gnani":
        return (
            "We couldn't transcribe this audio file. "
            "Please try again."
        )

    if stage == "upload":
        return (
            "We couldn't upload this audio file. "
            "Please try again."
        )

    return (
        "Something went wrong while processing this audio. "
        "Please try again."
    )