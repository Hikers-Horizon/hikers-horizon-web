package com.tatkalflash

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.accessibilityservice.GestureDescription
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Path
import android.graphics.Rect
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.ArrayList
import java.util.Locale

class BookingAccessibilityService : AccessibilityService() {

    private val TAG = "TatkalFlashAcc"
    private var lastState = ""
    private var searchingFor = ""
    private var firstSeenReservedTime: Long = 0L
    private var lastClickTime: Long = 0L
    private var hasLaunchedReserved = false
    private var detectedPackageName: String = ""

    private fun logToApp(msg: String) {
        Log.d(TAG, msg)
        MainActivity.instance?.addLog(msg)
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "Accessibility Service Connected")
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or 
                    AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or
                    AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            packageNames = null // Listen to all apps to prevent missing events due to namespace changes
        }
        this.serviceInfo = info
        logToApp("Accessibility Service Connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val rootNode = rootInActiveWindow ?: event.source ?: return

        // Verify that the event is from our target app variants
        val packageName = event.packageName?.toString() ?: ""
        if (!packageName.contains("cris", ignoreCase = true) &&
            !packageName.contains("railone", ignoreCase = true) &&
            !packageName.contains("aikyam", ignoreCase = true)) {
            return
        }
        
        // Remember the actual package name for deep link launches
        if (packageName.isNotEmpty() && detectedPackageName.isEmpty()) {
            detectedPackageName = packageName
            logToApp("Detected RailOne package: $detectedPackageName")
        }

        // Log window transitions to verify screen loaded states
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val className = event.className?.toString() ?: ""
            logToApp("Screen updated: package=$packageName, layoutClass=$className")
        }

        // Check if automation is active
        val sharedPref = getSharedPreferences("TatkalFlash", Context.MODE_PRIVATE)
        val active = sharedPref.getBoolean("extension_active", false)
        if (!active) return

        val configJson = sharedPref.getString("bookingConfig", "{}") ?: "{}"
        if (configJson == "{}") return

        try {
            val cfg = JSONObject(configJson)
            automateRailOne(rootNode, cfg)
        } catch (e: Exception) {
            Log.e(TAG, "Automation error", e)
        }
    }

    private fun automateRailOne(rootNode: AccessibilityNodeInfo, cfg: JSONObject) {
        // ─── STEP 1: Login Autofill ───
        val userField = findNodeBySuffixId(rootNode, "/et_username")
        if (userField != null && userField.text.isNullOrEmpty()) {
            val username = cfg.optString("username", "")
            if (username.isNotEmpty()) {
                setTextValue(userField, username)
                logToApp("Autofilled Username: $username")
            }
        }

        val passField = findNodeBySuffixId(rootNode, "/et_password")
        if (passField != null && passField.text.isNullOrEmpty()) {
            val password = cfg.optString("password", "")
            if (password.isNotEmpty()) {
                setTextValue(passField, password)
                logToApp("Autofilled Password")
            }
            
            // Focus on Captcha field to let the user type captcha
            val captchaField = findNodeBySuffixId(rootNode, "/et_captcha")
            captchaField?.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
        }

        // ─── STEP 1.5: mPIN Autofill ───
        val mpinTextNode = findNodeByText(rootNode, "Enter mPIN below") ?: findNodeByText(rootNode, "Login using mPIN")
        if (mpinTextNode != null) {
            val mpin = cfg.optString("mpin", "")
            if (mpin.isNotEmpty() && mpin.length == 6 && isStateChanged("fill_mpin")) {
                val inputs = ArrayList<AccessibilityNodeInfo>()
                findNodesByClass(rootNode, "android.widget.EditText", inputs)
                
                if (inputs.size == 6) {
                    for (i in 0 until 6) {
                        setTextValue(inputs[i], mpin[i].toString())
                    }
                    logToApp("Autofilled 6-digit mPIN")
                } else if (inputs.size == 1) {
                    setTextValue(inputs[0], mpin)
                    logToApp("Autofilled single-field mPIN")
                }
                
                // Click login button
                val loginBtn = findNodeByText(rootNode, "Login") ?: findNodeBySuffixId(rootNode, "/btn_login")
                if (loginBtn != null) {
                    clickNodeOrParent(loginBtn)
                    logToApp("Clicked mPIN Login button")
                }
            }
        }

        // ─── STEP 2: Reserved Ticket Form Fill ───
        // User clicks Reserved manually. Bot detects "Reserved Ticket" page and fills details.
        val reservedTicketTitle = findNodeByText(rootNode, "Reserved Ticket") ?: findNodeByText(rootNode, "Powered by IRCTC")
        if (reservedTicketTitle == null) {
            // Not on the Reserved Ticket page yet, skip form filling
            return
        }
        
        logToApp("On Reserved Ticket page. Starting form fill...")
        
        val fromStation = cfg.optString("from", "")
        val toStation = cfg.optString("to", "")
        val dateStr = cfg.optString("date", "")
        val className = cfg.optString("className", "SL")
        val quota = cfg.optString("quota", "TQ")

        // --- Handle Station Search popup (if open) ---
        val editTexts = ArrayList<AccessibilityNodeInfo>()
        findNodesByClass(rootNode, "android.widget.EditText", editTexts)
        val searchInput = editTexts.firstOrNull() ?: findNodeBySuffixId(rootNode, "/et_search")
        
        if (searchingFor.isNotEmpty() && searchInput != null) {
            val stationCode = if (searchingFor == "from") fromStation else toStation
            if (stationCode.isNotEmpty() && isStateChanged("typing_$searchingFor")) {
                setTextValue(searchInput, stationCode)
                logToApp("Typed station code: $stationCode for $searchingFor")
                // Wait a moment then select first suggestion
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    val root = rootInActiveWindow ?: return@postDelayed
                    selectFirstSuggestion(root)
                    searchingFor = ""
                }, 800)
                return
            }
        }

        // --- Fill "From" station ---
        val fromTextNode = findNodeByText(rootNode, "From")
        if (fromTextNode != null && fromStation.isNotEmpty()) {
            // Check if already filled by looking at sibling/next node text
            val fromParent = fromTextNode.parent
            val currentFromText = getStationTextValue(fromTextNode)
            if (currentFromText == null || !currentFromText.contains(fromStation, ignoreCase = true)) {
                if (isStateChanged("click_from")) {
                    searchingFor = "from"
                    clickNodeOrParent(fromTextNode)
                    logToApp("Opening From station search")
                    return
                }
            }
        }

        // --- Fill "To" station ---
        val toTextNode = findNodeByText(rootNode, "To")
        if (toTextNode != null && toStation.isNotEmpty()) {
            val currentToText = getStationTextValue(toTextNode)
            if (currentToText == null || !currentToText.contains(toStation, ignoreCase = true)) {
                if (isStateChanged("click_to")) {
                    searchingFor = "to"
                    clickNodeOrParent(toTextNode)
                    logToApp("Opening To station search")
                    return
                }
            }
        }

        // --- Select Departure Date (quick date chips: "10 Jul", "11 Jul", etc.) ---
        if (dateStr.isNotEmpty()) {
            val formattedDate = formatJourneyDate(dateStr)
            if (formattedDate.isNotEmpty()) {
                val quickDateBtn = findNodeByText(rootNode, formattedDate)
                if (quickDateBtn != null && isStateChanged("click_date_$formattedDate")) {
                    clickNodeOrParent(quickDateBtn)
                    logToApp("Selected date: $formattedDate")
                    return
                }
            }
        }

        // --- Select Class (chip buttons: 2S, VS, SL, CC, VC, All) ---
        if (className.isNotEmpty()) {
            val classBtn = findNodeByText(rootNode, className)
            if (classBtn != null && isStateChanged("click_class_$className")) {
                clickNodeOrParent(classBtn)
                logToApp("Selected class: $className")
                return
            }
        }

        // --- Select Quota (dropdown) ---
        val quotaLabel = when (quota) {
            "TQ" -> "Tatkal"
            "PT" -> "Premium Tatkal"
            "LD" -> "Ladies"
            "HP" -> "Physically Handicapped"
            "DF" -> "Defence"
            else -> "General"
        }
        
        // If quota is not General, we need to open the dropdown and select
        if (quotaLabel != "General") {
            // Check if the dropdown currently shows "General" (needs changing)
            val currentQuota = findNodeByText(rootNode, "General")
            if (currentQuota != null && isStateChanged("open_quota_dropdown")) {
                clickNodeOrParent(currentQuota)
                logToApp("Opening quota dropdown to change from General to $quotaLabel")
                return
            }
            
            // Select the desired quota from the dropdown list
            val quotaOption = findNodeByText(rootNode, quotaLabel)
            if (quotaOption != null && isStateChanged("select_quota_$quotaLabel")) {
                clickNodeOrParent(quotaOption)
                logToApp("Selected quota: $quotaLabel")
                return
            }
        }

        // --- Click Search Button ---
        val searchButton = findNodeByText(rootNode, "Search") ?: findNodeByText(rootNode, "SEARCH")
        if (searchButton != null && isStateChanged("click_search")) {
            clickNodeOrParent(searchButton)
            logToApp("Clicked Search button!")
            return
        }

        // ─── STEP 4: Train List Availability ───
        val trainNum = cfg.optString("trainNum", "")
        if (trainNum.isNotEmpty()) {
            val trainNode = findNodeByText(rootNode, trainNum)
            if (trainNode != null && isStateChanged("select_train_$trainNum")) {
                clickNodeOrParent(trainNode)
                logToApp("Selected Train: $trainNum")
                return
            }
        }

        // Select Quota fallback
        val quotaNode = findNodeByText(rootNode, quotaLabel.uppercase(Locale.ENGLISH))
        if (quotaNode != null && isStateChanged("select_quota_fallback")) {
            clickNodeOrParent(quotaNode)
            logToApp("Selected Quota fallback: $quotaLabel")
            return
        }

        // Book Now triggers
        val bookNow = findNodeByText(rootNode, "Book Now") ?: findNodeByText(rootNode, "BOOK NOW") ?: findNodeByText(rootNode, "Passenger Details")
        if (bookNow != null && isStateChanged("click_book_now")) {
            clickNodeOrParent(bookNow)
            logToApp("Clicked Book Now / Passenger Details")
            return
        }

        // ─── STEP 5: Passenger Profile Details ───
        val passengers = cfg.optJSONArray("passengers")
        if (passengers != null && passengers.length() > 0) {
            val addPaxBtn = findNodeByText(rootNode, "Add Passenger") ?: findNodeByText(rootNode, "Add New")
            if (addPaxBtn != null && isStateChanged("add_passengers")) {
                val inputs = ArrayList<AccessibilityNodeInfo>()
                findNodesByClass(rootNode, "android.widget.EditText", inputs)
                
                if (inputs.isNotEmpty()) {
                    val p = passengers.getJSONObject(0)
                    val nameInput = inputs[0]
                    if (nameInput.text.isNullOrEmpty()) {
                        setTextValue(nameInput, p.optString("name", ""))
                    }
                    if (inputs.size > 1) {
                        val ageInput = inputs[1]
                        if (ageInput.text.isNullOrEmpty()) {
                            setTextValue(ageInput, p.optString("age", ""))
                        }
                    }
                    logToApp("Autofilled Passenger Details")
                }
            }
        }
    }

    private fun findReservedNode(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        val txt = root.text?.toString() ?: ""
        val desc = root.contentDescription?.toString() ?: ""
        val id = root.viewIdResourceName?.toString() ?: ""
        val className = root.className?.toString() ?: ""
        
        // Broaden search criteria based on the visual layout
        // Usually, the "Reserved" text is in a TextView, and there's an ImageView or a parent container above it.
        if (txt.contains("Reserved", ignoreCase = true) || 
            desc.contains("Reserved", ignoreCase = true) || 
            id.contains("reserved", ignoreCase = true)) {
            
            logToApp("Found Reserved node: text=$txt, desc=$desc, id=$id, class=$className")
            
            // If we found the text "Reserved", it might not be the clickable part.
            // We should return this node, and clickNodeOrParent will find the clickable parent.
            return root
        }
        
        // Also look for common IDs used in RailOne if possible
        if (id.contains("iv_reserved") || id.contains("ll_reserved") || id.contains("layout_reserved")) {
            logToApp("Found Reserved container by ID: $id")
            return root
        }

        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            val found = findReservedNode(child)
            if (found != null) return found
        }
        return null
    }

    // ─── Helper utilities ───
    private fun findNodeByText(root: AccessibilityNodeInfo, text: String): AccessibilityNodeInfo? {
        val list = root.findAccessibilityNodeInfosByText(text)
        return if (list != null && list.isNotEmpty()) list[0] else null
    }

    private fun findNodeBySuffixId(root: AccessibilityNodeInfo, suffix: String): AccessibilityNodeInfo? {
        if (root.viewIdResourceName != null && root.viewIdResourceName.toString().endsWith(suffix)) {
            return root
        }
        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            val found = findNodeBySuffixId(child, suffix)
            if (found != null) return found
        }
        return null
    }

    private fun findNodesBySuffixId(root: AccessibilityNodeInfo, suffix: String, results: ArrayList<AccessibilityNodeInfo>) {
        if (root.viewIdResourceName != null && root.viewIdResourceName.toString().endsWith(suffix)) {
            results.add(root)
        }
        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            findNodesBySuffixId(child, suffix, results)
        }
    }

    private fun findNodesByClass(root: AccessibilityNodeInfo, className: String, results: ArrayList<AccessibilityNodeInfo>) {
        if (root.className != null && root.className.toString() == className) {
            results.add(root)
        }
        for (i in 0 until root.childCount) {
            val child = root.getChild(i) ?: continue
            findNodesByClass(child, className, results)
        }
    }

    private fun getStationTextValue(labelNode: AccessibilityNodeInfo): String? {
        val parent = labelNode.parent ?: return null
        for (i in 0 until parent.childCount) {
            val child = parent.getChild(i) ?: continue
            if (child != labelNode && child.className?.toString()?.contains("TextView") == true) {
                val txt = child.text
                if (txt != null && txt.isNotEmpty()) {
                    return txt.toString()
                }
            }
        }
        return null
    }

    private fun formatJourneyDate(dateStr: String): String {
        try {
            val parser = SimpleDateFormat("yyyy-MM-dd", Locale.ENGLISH)
            val formatter = SimpleDateFormat("d MMM", Locale.ENGLISH)
            val date = parser.parse(dateStr)
            if (date != null) {
                return formatter.format(date)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error formatting date", e)
        }
        return ""
    }

    private fun setTextValue(node: AccessibilityNodeInfo, text: String) {
        val arguments = Bundle()
        arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
    }

    private fun clickNodeOrParent(node: AccessibilityNodeInfo): Boolean {
        var temp: AccessibilityNodeInfo? = node
        while (temp != null) {
            if (temp.isClickable && temp.isEnabled) {
                val success = temp.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                if (success) {
                    logToApp("Successfully performed ACTION_CLICK on ${temp.className}")
                    return true
                }
            }
            temp = temp.parent
        }
        
        // If normal click fails, try clicking the center of the node via gesture
        logToApp("Normal click failed or no clickable parent, trying gesture click")
        return clickNodeViaGesture(node)
    }

    private fun clickNodeViaGesture(node: AccessibilityNodeInfo): Boolean {
        val bounds = Rect()
        node.getBoundsInScreen(bounds)
        val x = bounds.centerX().toFloat()
        val y = bounds.centerY().toFloat()

        val path = Path()
        path.moveTo(x, y)
        
        val gestureBuilder = GestureDescription.Builder()
        val strokeDescription = GestureDescription.StrokeDescription(path, 0, 50)
        gestureBuilder.addStroke(strokeDescription)
        
        return dispatchGesture(gestureBuilder.build(), null, null)
    }

    private fun tapAtCoordinates(x: Float, y: Float): Boolean {
        val path = Path()
        path.moveTo(x, y)
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 50))
            .build()
        return dispatchGesture(gesture, null, null)
    }

    private fun launchReservedActivity() {
        val pkgName = if (detectedPackageName.isNotEmpty()) detectedPackageName else "org.cris.aikyam"
        logToApp("Attempting deep link for package: $pkgName")
        
        try {
            // Step 1: Scan all activities in the package and find reserved/booking related ones
            val pkgInfo = packageManager.getPackageInfo(pkgName, PackageManager.GET_ACTIVITIES)
            val activities = pkgInfo.activities
            
            if (activities != null) {
                logToApp("Found ${activities.size} activities in $pkgName")
                
                // Log all activities for debugging
                val activityNames = activities.map { it.name }
                for (name in activityNames) {
                    logToApp("  Activity: $name")
                }
                
                // Find the best match for reserved ticket booking
                val keywords = listOf("reserved", "book", "journey", "ticket", "plan")
                var targetActivity: String? = null
                
                for (kw in keywords) {
                    for (name in activityNames) {
                        if (name.contains(kw, ignoreCase = true)) {
                            targetActivity = name
                            logToApp("Matched activity '$name' with keyword '$kw'")
                            break
                        }
                    }
                    if (targetActivity != null) break
                }
                
                // Try to launch the matched activity
                if (targetActivity != null) {
                    val intent = Intent()
                    intent.component = ComponentName(pkgName, targetActivity)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(intent)
                    logToApp("Launched activity: $targetActivity")
                    return
                }
            }
        } catch (e: Exception) {
            logToApp("Activity scan failed: ${e.message}")
        }
        
        // Step 2: Try common known activity names
        val commonActivities = listOf(
            "$pkgName.ui.reserved.ReservedActivity",
            "$pkgName.ui.booking.BookingActivity",
            "$pkgName.ui.journey.JourneyPlannerActivity",
            "$pkgName.ui.home.ReservedTicketActivity",
            "$pkgName.reserved.ReservedActivity",
            "$pkgName.booking.BookTicketActivity",
            "$pkgName.ReservedActivity",
            "$pkgName.BookTicketActivity"
        )
        
        for (actName in commonActivities) {
            try {
                val intent = Intent()
                intent.component = ComponentName(pkgName, actName)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(intent)
                logToApp("Launched common activity: $actName")
                return
            } catch (e: Exception) {
                // Activity doesn't exist, try next
            }
        }
        
        // Step 3: Try deep link URIs
        val deepLinks = listOf(
            "railone://reserved",
            "railone://book/reserved",
            "railone://journey/reserved",
            "irctc://reserved",
            "irctc://book"
        )
        
        for (link in deepLinks) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link))
                intent.setPackage(pkgName)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(intent)
                logToApp("Launched deep link: $link")
                return
            } catch (e: Exception) {
                // Deep link not supported, try next
            }
        }
        
        logToApp("All launch strategies failed. Check activity list above for correct name.")
        // Reset so we can try again
        hasLaunchedReserved = false
    }

    private fun selectFirstSuggestion(rootNode: AccessibilityNodeInfo) {
        val suggestions = ArrayList<AccessibilityNodeInfo>()
        findNodesBySuffixId(rootNode, "/tv_station_name", suggestions)
        if (suggestions.isEmpty()) {
            // Fallback: look for tv_station_code
            findNodesBySuffixId(rootNode, "/tv_station_code", suggestions)
        }
        if (suggestions.isNotEmpty()) {
            clickNodeOrParent(suggestions[0])
            logToApp("Selected station suggestion")
        }
    }

    private fun isStateChanged(action: String): Boolean {
        if (lastState == action) return false
        lastState = action
        return true
    }

    override fun onInterrupt() {
        Log.d(TAG, "Service Interrupted")
    }

    private fun dumpNodeTree(node: AccessibilityNodeInfo?, sb: StringBuilder, depth: Int) {
        if (node == null) return
        val indent = "  ".repeat(depth)
        val text = node.text?.toString() ?: ""
        val desc = node.contentDescription?.toString() ?: ""
        val id = node.viewIdResourceName?.toString() ?: ""
        val cls = node.className?.toString()?.substringAfterLast('.') ?: ""
        val clickable = if (node.isClickable) "[C]" else ""
        val bounds = Rect()
        node.getBoundsInScreen(bounds)
        
        if (text.isNotEmpty() || desc.isNotEmpty() || id.isNotEmpty() || node.isClickable) {
            sb.append("$indent$cls $clickable txt=\"$text\" desc=\"$desc\" id=\"$id\" bounds=$bounds\n")
        }
        
        for (i in 0 until node.childCount) {
            dumpNodeTree(node.getChild(i), sb, depth + 1)
        }
    }
}
