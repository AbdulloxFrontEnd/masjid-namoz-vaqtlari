import UIKit
import WebKit
import CoreLocation

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, CLLocationManagerDelegate {

    private var webView: WKWebView!
    private var locationManager: CLLocationManager!
    private var refreshControl: UIRefreshControl!

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 6/255.0, green: 78/255.0, blue: 59/255.0, alpha: 1.0) // Emerald #064e3b
        
        setupLocationManager()
        setupWebView()
        setupRefreshControl()
        loadLocalApp()
    }

    private func setupLocationManager() {
        locationManager = CLLocationManager()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.headingFilter = 1.0 // Har 1 gradus o'zgarganda bildirishnoma berish

        // Joylashuv va harakat ruxsatini so'rash
        if CLLocationManager.locationServicesEnabled() {
            locationManager.requestWhenInUseAuthorization()
            locationManager.startUpdatingLocation()
            if CLLocationManager.headingAvailable() {
                locationManager.startUpdatingHeading()
            }
        }
    }

    private func setupWebView() {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        
        // Mahalliylashtirilgan fayllarga ruxsat
        configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        configuration.setValue(true, forKey: "allowUniversalAccessFromFileURLs")

        let webpagePreferences = WKWebpagePreferences()
        webpagePreferences.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences = webpagePreferences

        webView = WKWebView(frame: view.bounds, configuration: configuration)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.backgroundColor = UIColor(red: 6/255.0, green: 78/255.0, blue: 59/255.0, alpha: 1.0)
        webView.isOpaque = true
        webView.scrollView.bounces = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        view.addSubview(webView)
    }

    private func setupRefreshControl() {
        refreshControl = UIRefreshControl()
        refreshControl.tintColor = UIColor(red: 52/255.0, green: 211/255.0, blue: 153/255.0, alpha: 1.0)
        refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        webView.scrollView.addSubview(refreshControl)
    }

    @objc private func handleRefresh() {
        webView.reload()
    }

    private func loadLocalApp() {
        if let wwwPath = Bundle.main.path(forResource: "index", ofType: "html", inDirectory: "www") {
            let fileUrl = URL(fileURLWithPath: wwwPath)
            let readAccessUrl = fileUrl.deletingLastPathComponent()
            webView.loadFileURL(fileUrl, allowingReadAccessTo: readAccessUrl)
        } else if let localIndex = Bundle.main.url(forResource: "index", withExtension: "html") {
            let readAccessUrl = localIndex.deletingLastPathComponent()
            webView.loadFileURL(localIndex, allowingReadAccessTo: readAccessUrl)
        } else {
            // Zaxira: Jonli server / Cloudflare manzili
            if let remoteUrl = URL(string: "https://included-nat-collecting-quantum.trycloudflare.com") {
                webView.load(URLRequest(url: remoteUrl))
            }
        }
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshControl.endRefreshing()

        // Oxirgi joylashuv va kompas azimutini JavaScriptga uzatish
        if let loc = locationManager.location {
            sendLocationToWeb(latitude: loc.coordinate.latitude, longitude: loc.coordinate.longitude)
        }
        if let heading = locationManager.heading {
            let h = heading.trueHeading >= 0 ? heading.trueHeading : heading.magneticHeading
            sendHeadingToWeb(heading: h)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        // Tashqi xarita manzillari (Yandex / Google Maps)
        if url.host?.contains("yandex.") == true || url.host?.contains("google.") == true {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }

    // MARK: - CLLocationManagerDelegate (Joylashuv va Kompas)
    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        let headingValue = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        sendHeadingToWeb(heading: headingValue)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        sendLocationToWeb(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude)
    }

    private func sendHeadingToWeb(heading: Double) {
        let js = "if (typeof applyCompassHeading === 'function') { applyCompassHeading(\(heading), false); }"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    private func sendLocationToWeb(latitude: Double, longitude: Double) {
        let js = "if (typeof setUserLocationFromNative === 'function') { setUserLocationFromNative(\(latitude), \(longitude)); }"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    // MARK: - WKUIDelegate (JS dialoglari)
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "Masjidlar", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default, handler: { _ in completionHandler() }))
        present(alert, animated: true)
    }
}
